from __future__ import annotations

import base64
import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from job_agent.feishu_sync import coerce_jobs_json_row, consolidate_jobs, from_feishu_cells, materialize_dashboard_stores, merge_feishu_rows, to_feishu_cells


DATA_PATHS = {
    "applications": "data/applications.json",
    "opportunities": "data/opportunities.json",
    "historical": "data/historical-opportunities.json",
    "jds": "data/jds.json",
    "jobs": "data/jobs.json",
}


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._reply(200, {
            "ok": True,
            "service": "feishu-base-sync",
            "configured": all(os.environ.get(name) for name in _required_env()),
            "branch": os.environ.get("GITHUB_SYNC_BRANCH", "feature/campus-job-os-v2"),
        })

    def do_POST(self) -> None:
        expected = os.environ.get("SYNC_WEBHOOK_SECRET", "")
        supplied = self.headers.get("x-sync-secret", "")
        if not expected or supplied != expected:
            self._reply(401, {"ok": False, "error": "unauthorized"})
            return
        try:
            result = run_sync()
        except Exception as exc:  # Vercel must return the real failure, never fabricated data.
            self._reply(500, {"ok": False, "error": str(exc)})
            return
        self._reply(200, {"ok": True, **result})

    def _reply(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.end_headers()
        self.wfile.write(body)


def run_sync() -> dict[str, Any]:
    missing = [name for name in _required_env() if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing runtime configuration: {', '.join(missing)}")

    repo = os.environ.get("GITHUB_SYNC_REPO", "hayley08/job-hunting-buddy")
    branch = os.environ.get("GITHUB_SYNC_BRANCH", "feature/campus-job-os-v2")
    github_token = os.environ["GITHUB_SYNC_TOKEN"]
    baseline = {key: _github_json(repo, branch, path, github_token) for key, path in DATA_PATHS.items() if key != "jobs"}
    repo_jobs = consolidate_jobs(baseline["applications"], baseline["opportunities"], baseline["historical"], baseline["jds"])
    try:
        jobs_json = _github_json(repo, branch, DATA_PATHS["jobs"], github_token)
    except RuntimeError as exc:
        if "404" not in str(exc):
            raise
        jobs_json = []
    if isinstance(jobs_json, list):
        repo_jobs = merge_feishu_rows(repo_jobs, [coerce_jobs_json_row(item) for item in jobs_json if isinstance(item, dict)])

    tenant_token = _feishu_tenant_token(os.environ["FEISHU_APP_ID"], os.environ["FEISHU_APP_SECRET"])
    base_token = os.environ["FEISHU_BASE_TOKEN"]
    table_id = os.environ["FEISHU_TABLE_ID"]
    records = _feishu_records(tenant_token, base_token, table_id)
    by_job_id = {
        str(from_feishu_cells(item.get("fields", {})).get("jobId")): item
        for item in records
        if from_feishu_cells(item.get("fields", {})).get("jobId")
    }

    missing_in_base = [to_feishu_cells(job) for job in repo_jobs if str(job.get("jobId")) not in by_job_id]
    if missing_in_base:
        _feishu_batch_create(tenant_token, base_token, table_id, missing_in_base)
        records = _feishu_records(tenant_token, base_token, table_id)

    rows = [from_feishu_cells(item.get("fields", {})) for item in records]
    rows = [row for row in rows if row.get("jobId")]
    jobs = merge_feishu_rows(repo_jobs, rows)
    stores = materialize_dashboard_stores(jobs, baseline)
    generated = {
        DATA_PATHS["jobs"]: jobs,
        DATA_PATHS["applications"]: stores["applications"],
        DATA_PATHS["opportunities"]: stores["opportunities"],
        DATA_PATHS["historical"]: stores["historical"],
        DATA_PATHS["jds"]: stores["jds"],
    }

    changed: dict[str, Any] = {}
    for path, payload in generated.items():
        try:
            current = _github_json(repo, branch, path, github_token)
        except RuntimeError as exc:
            if "404" not in str(exc):
                raise
            current = None
        if current != payload:
            changed[path] = payload
    if not changed:
        return {"changed": False, "createdInFeishu": len(missing_in_base), "recordCount": len(jobs)}

    commit_sha = _github_commit_files(repo, branch, changed, github_token)
    return {
        "changed": True,
        "createdInFeishu": len(missing_in_base),
        "recordCount": len(jobs),
        "files": sorted(changed),
        "commitSha": commit_sha,
    }


def _required_env() -> tuple[str, ...]:
    return ("FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_BASE_TOKEN", "FEISHU_TABLE_ID", "GITHUB_SYNC_TOKEN", "SYNC_WEBHOOK_SECRET")


def _request_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, body: Any = None) -> dict[str, Any]:
    encoded = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    request_headers = {"Accept": "application/json", **(headers or {})}
    if encoded is not None:
        request_headers["Content-Type"] = "application/json; charset=utf-8"
    request = Request(url, data=encoded, method=method, headers=request_headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {detail[:500]}") from exc


def _feishu_tenant_token(app_id: str, app_secret: str) -> str:
    payload = _request_json("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", method="POST", body={"app_id": app_id, "app_secret": app_secret})
    if payload.get("code") != 0 or not payload.get("tenant_access_token"):
        raise RuntimeError(f"Feishu authentication failed: {payload.get('msg', payload)}")
    return payload["tenant_access_token"]


def _feishu_records(token: str, base_token: str, table_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page_token = ""
    while True:
        query = {"page_size": 200}
        if page_token:
            query["page_token"] = page_token
        url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{quote(base_token)}/tables/{quote(table_id)}/records?{urlencode(query)}"
        payload = _request_json(url, headers={"Authorization": f"Bearer {token}"})
        if payload.get("code") != 0:
            raise RuntimeError(f"Feishu record read failed: {payload.get('msg', payload)}")
        data = payload.get("data", {})
        items.extend(data.get("items", []))
        if not data.get("has_more"):
            return items
        page_token = data.get("page_token", "")


def _feishu_batch_create(token: str, base_token: str, table_id: str, rows: list[dict[str, Any]]) -> None:
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{quote(base_token)}/tables/{quote(table_id)}/records/batch_create"
    for offset in range(0, len(rows), 200):
        payload = _request_json(url, method="POST", headers={"Authorization": f"Bearer {token}"}, body={"records": [{"fields": row} for row in rows[offset:offset + 200]]})
        if payload.get("code") != 0:
            raise RuntimeError(f"Feishu record create failed: {payload.get('msg', payload)}")


def _github_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def _github_json(repo: str, branch: str, path: str, token: str) -> Any:
    url = f"https://api.github.com/repos/{repo}/contents/{quote(path)}?ref={quote(branch, safe='')}"
    payload = _request_json(url, headers=_github_headers(token))
    return json.loads(base64.b64decode(payload["content"]).decode("utf-8"))


def _github_commit_files(repo: str, branch: str, files: dict[str, Any], token: str) -> str:
    headers = _github_headers(token)
    ref_url = f"https://api.github.com/repos/{repo}/git/ref/heads/{quote(branch, safe='')}"
    ref = _request_json(ref_url, headers=headers)
    parent_sha = ref["object"]["sha"]
    commit = _request_json(f"https://api.github.com/repos/{repo}/git/commits/{parent_sha}", headers=headers)
    entries = []
    for path, payload in files.items():
        content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        blob = _request_json(f"https://api.github.com/repos/{repo}/git/blobs", method="POST", headers=headers, body={"content": content, "encoding": "utf-8"})
        entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    tree = _request_json(f"https://api.github.com/repos/{repo}/git/trees", method="POST", headers=headers, body={"base_tree": commit["tree"]["sha"], "tree": entries})
    new_commit = _request_json(f"https://api.github.com/repos/{repo}/git/commits", method="POST", headers=headers, body={"message": "data: sync jobs from Feishu Base", "tree": tree["sha"], "parents": [parent_sha]})
    _request_json(ref_url, method="PATCH", headers=headers, body={"sha": new_commit["sha"], "force": False})
    return new_commit["sha"]
