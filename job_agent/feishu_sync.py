from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from typing import Any, Iterable


SHANGHAI = timezone(timedelta(hours=8), name="UTC+8")

APPLICATION_STATUSES = {
    "Application In Progress",
    "Applied",
    "Resume Screening",
    "Online Assessment",
    "Written Test",
    "HR Interview",
    "Business Interview",
    "Case Interview",
    "Final Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
    "Closed",
}

JSON_FIELDS = {
    "matchReasons",
    "risks",
    "recommendationDates",
    "statusHistory",
    "manualOverrides",
    "jdDistinctiveKeywords",
    "jdCoreResponsibilities",
    "jdUniqueRequirements",
    "jdInterviewSignals",
    "jdMustHave",
    "jdNiceToHave",
    "jdKeyOriginalExcerpt",
    "jdVersions",
}

DATE_FIELDS = {
    "foundDate",
    "postedDate",
    "applicationStartedAt",
    "appliedDate",
    "deadline",
    "recommendationDate",
    "statusUpdatedAt",
}

DATETIME_FIELDS = {"foundAt", "firstRecommendedAt", "jdCapturedAt"}

# Every name below already exists in applications, opportunities, or jds.json.
# This is a Feishu projection of the current schema, not a new job schema.
FEISHU_FIELD_SPECS: list[dict[str, Any]] = [
    {"name": "jobId", "type": "text"},
    {"name": "company", "type": "text"},
    {"name": "title", "type": "text"},
    {"name": "location", "type": "text"},
    {"name": "currentStatus", "type": "select", "multiple": False, "options": [
        {"name": value} for value in ["Saved", "Recommended", "Application In Progress", "Applied", "Resume Screening", "Online Assessment", "Written Test", "HR Interview", "Business Interview", "Case Interview", "Final Interview", "Offer", "Rejected", "Withdrawn", "Closed", "Archived"]
    ]},
    {"name": "classification", "type": "select", "multiple": False, "options": [
        {"name": value} for value in ["APPLY_NOW", "OPEN", "WATCH", "UPCOMING", "HISTORICAL", "VERIFY"]
    ]},
    {"name": "matchScore", "type": "number", "style": {"type": "rating", "icon": "number", "min": 1, "max": 10}},
    {"name": "notes", "type": "text"},
    {"name": "matchReasons", "type": "text"},
    {"name": "risks", "type": "text"},
    {"name": "applyUrl", "type": "text", "style": {"type": "url"}},
    {"name": "jdUrl", "type": "text", "style": {"type": "url"}},
    {"name": "officialUrl", "type": "text", "style": {"type": "url"}},
    {"name": "source", "type": "text"},
    {"name": "sourceJobId", "type": "text"},
    {"name": "market", "type": "text"},
    {"name": "industry", "type": "text"},
    {"name": "jobFamily", "type": "text"},
    {"name": "campusType", "type": "text"},
    {"name": "salary", "type": "text"},
    {"name": "experience", "type": "text"},
    {"name": "foundDate", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "postedDate", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "applicationStartedAt", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "appliedDate", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "deadline", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "recommendationDate", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "firstRecommendedAt", "type": "datetime", "style": {"format": "yyyy-MM-dd HH:mm"}},
    {"name": "statusUpdatedAt", "type": "datetime", "style": {"format": "yyyy-MM-dd"}},
    {"name": "archived", "type": "checkbox"},
    {"name": "sourceOfTruth", "type": "text"},
    {"name": "sourcePriority", "type": "select", "multiple": False, "options": [
        {"name": value} for value in ["P0", "P0+P2", "P1", "P2", "P3 Lead"]
    ]},
    {"name": "linkStatus", "type": "select", "multiple": False, "options": [
        {"name": value} for value in ["VERIFIED", "UNVERIFIED"]
    ]},
    {"name": "jdStatus", "type": "select", "multiple": False, "options": [
        {"name": value} for value in ["Complete JD", "Current JD", "Current JD - Link Unverified", "Historical JD", "JD Missing", "Partial JD - Link Unverified"]
    ]},
    {"name": "jdRaw", "type": "text"},
    {"name": "jdSummary", "type": "text"},
    {"name": "jdCapturedAt", "type": "datetime", "style": {"format": "yyyy-MM-dd HH:mm"}},
    {"name": "statusHistory", "type": "text"},
    {"name": "manualOverrides", "type": "text"},
]


def consolidate_jobs(
    applications: Iterable[dict[str, Any]],
    opportunities: Iterable[dict[str, Any]],
    historical: Iterable[dict[str, Any]],
    jds: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Create one lossless jobId-keyed mirror from the existing V2 stores."""
    jobs: dict[str, dict[str, Any]] = {}
    for collection in (applications, opportunities, historical):
        for item in collection:
            job_id = str(item.get("jobId") or "").strip()
            if not job_id:
                continue
            jobs[job_id] = deepcopy(item)
    for jd in jds:
        job_id = str(jd.get("jobId") or "").strip()
        if job_id in jobs:
            jobs[job_id].update(deepcopy(jd))
    return sorted(jobs.values(), key=lambda item: (str(item.get("company", "")).casefold(), str(item.get("title", "")).casefold(), item["jobId"]))


def merge_feishu_rows(
    existing_jobs: Iterable[dict[str, Any]],
    feishu_rows: Iterable[dict[str, Any]],
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Overlay Base rows by canonical jobId while preserving unprojected repo data."""
    merged = {str(item["jobId"]): deepcopy(item) for item in existing_jobs if item.get("jobId")}
    sync_time = (now or datetime.now(SHANGHAI)).astimezone(SHANGHAI)
    sync_date = sync_time.date().isoformat()
    for incoming in feishu_rows:
        job_id = str(incoming.get("jobId") or "").strip()
        if not job_id:
            continue
        current = merged.setdefault(job_id, {"jobId": job_id})
        old_status = current.get("currentStatus")
        for key, value in incoming.items():
            if key == "jobId" or value is None:
                continue
            current[key] = deepcopy(value)
        new_status = current.get("currentStatus")
        if new_status and new_status != old_status:
            history = current.get("statusHistory")
            if not isinstance(history, list):
                history = []
            if not any(event.get("status") == new_status and event.get("date") == sync_date for event in history if isinstance(event, dict)):
                history.append({
                    "status": new_status,
                    "date": sync_date,
                    "sourceOfTruth": "user",
                    "note": "Status updated in Feishu Base.",
                    "notes": "Status updated in Feishu Base.",
                })
            current["statusHistory"] = history
            current["statusUpdatedAt"] = sync_date
            current["sourceOfTruth"] = "user"
        _validate_job_identity(current)
    return sorted(merged.values(), key=lambda item: (str(item.get("company", "")).casefold(), str(item.get("title", "")).casefold(), item["jobId"]))


def materialize_dashboard_stores(
    jobs: Iterable[dict[str, Any]],
    baseline: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    """Project the unified mirror back into the dashboard's existing JSON schemas."""
    allowed = {
        key: {field for item in baseline[key] for field in item}
        for key in ("applications", "opportunities", "historical", "jds")
    }
    output = {key: [] for key in allowed}
    baseline_jds = {item.get("jobId"): deepcopy(item) for item in baseline["jds"] if item.get("jobId")}
    jd_allowed = allowed["jds"]
    materialized_job_ids: set[str] = set()

    for source in jobs:
        item = deepcopy(source)
        materialized_job_ids.add(str(item.get("jobId") or ""))
        status = str(item.get("currentStatus") or "")
        classification = str(item.get("classification") or "")
        if classification == "HISTORICAL" or status == "Archived":
            target = "historical"
        elif status in APPLICATION_STATUSES or item.get("appliedDate") or item.get("applicationStartedAt"):
            target = "applications"
        else:
            target = "opportunities"
        record = {key: value for key, value in item.items() if key in allowed[target]}
        _apply_required_defaults(record, target)
        output[target].append(record)

        jd = baseline_jds.get(item.get("jobId"), {"jobId": item.get("jobId")})
        for key in jd_allowed:
            if key in item:
                jd[key] = deepcopy(item[key])
        if jd.get("jobId"):
            _apply_jd_defaults(jd)
            output["jds"].append({key: value for key, value in jd.items() if key in jd_allowed})

    # Reminder-list and other non-job JD records remain in the existing JD store.
    for job_id, jd in baseline_jds.items():
        if str(job_id) not in materialized_job_ids:
            output["jds"].append({key: value for key, value in jd.items() if key in jd_allowed})

    for key in output:
        output[key].sort(key=lambda item: (str(item.get("company", "")).casefold(), str(item.get("title", "")).casefold(), str(item.get("jobId", ""))))
    return output


def to_feishu_cells(job: dict[str, Any]) -> dict[str, Any]:
    cells: dict[str, Any] = {}
    for spec in FEISHU_FIELD_SPECS:
        name = spec["name"]
        if name not in job or job[name] in (None, ""):
            continue
        value = job[name]
        if name in JSON_FIELDS:
            value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        elif spec["type"] == "datetime":
            value = _to_feishu_datetime(value)
            if value is None:
                continue
        elif spec["type"] == "number":
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue
        elif spec["type"] == "checkbox":
            value = bool(value)
        elif not isinstance(value, str):
            value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        cells[name] = value
    return cells


def from_feishu_cells(cells: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {}
    known_fields = {spec["name"] for spec in FEISHU_FIELD_SPECS}
    for name, raw in cells.items():
        if name not in known_fields:
            continue
        value = _unwrap_feishu_value(raw)
        if value in (None, ""):
            continue
        if name in JSON_FIELDS and isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = [line.strip() for line in value.splitlines() if line.strip()] if name != "manualOverrides" else {}
        elif name in DATE_FIELDS:
            value = _from_feishu_datetime(value, date_only=True)
        elif name in DATETIME_FIELDS:
            value = _from_feishu_datetime(value, date_only=False)
        elif name == "matchScore":
            value = int(float(value))
        elif name == "archived":
            value = bool(value)
        row[name] = value
    return row


def field_names() -> list[str]:
    return [spec["name"] for spec in FEISHU_FIELD_SPECS]


def coerce_jobs_json_row(item: dict[str, Any]) -> dict[str, Any]:
    """Map the legacy daily-run Job dictionary into existing V2 field names."""
    if item.get("currentStatus") or item.get("classification") or item.get("applyUrl"):
        return deepcopy(item)
    url = str(item.get("url") or item.get("canonicalUrl") or "")
    reason = item.get("matchReason") or item.get("recommendation_reason") or ""
    risk = item.get("risk") or ""
    raw_jd = item.get("jobDescription") or ""
    return {
        "jobId": item.get("jobId") or item.get("sourceJobId"),
        "sourceJobId": item.get("jobId") or item.get("sourceJobId") or "",
        "company": item.get("company", ""),
        "title": item.get("title", ""),
        "location": item.get("location", ""),
        "market": "Mainland",
        "industry": item.get("industry", ""),
        "source": item.get("source", ""),
        "applyUrl": url,
        "jdUrl": url,
        "officialUrl": url,
        "foundDate": item.get("foundDate", ""),
        "postedDate": item.get("postedDate", ""),
        "currentStatus": "Saved",
        "classification": "OPEN" if item.get("activeStatus") == "active" else "VERIFY",
        "matchScore": item.get("matchScore", 0),
        "matchReasons": [reason] if reason else [],
        "risks": [risk] if risk else [],
        "salary": item.get("salary", ""),
        "experience": item.get("experience", ""),
        "jdStatus": "Current JD" if raw_jd else "JD Missing",
        "jdRaw": raw_jd,
        "jdSummary": "",
        "sourceOfTruth": "search-adapter",
        "archived": False,
    }


def _validate_job_identity(item: dict[str, Any]) -> None:
    if not item.get("jobId"):
        raise ValueError("Feishu row is missing jobId")
    if not item.get("company") or not item.get("title"):
        raise ValueError(f"Feishu row {item['jobId']} is missing company/title")
    urls = [item.get(name) for name in ("applyUrl", "jdUrl", "officialUrl", "sourceUrl") if item.get(name)]
    if urls and any(not str(url).startswith("https://") for url in urls):
        raise ValueError(f"Feishu row {item['jobId']} contains a non-HTTPS job URL")


def _apply_required_defaults(record: dict[str, Any], target: str) -> None:
    record.setdefault("market", "Mainland")
    record.setdefault("archived", False)
    if target == "applications":
        record.setdefault("statusHistory", [])
        record.setdefault("manualOverrides", {})
    else:
        record.setdefault("recommendationDates", [record["recommendationDate"]] if record.get("recommendationDate") else [])
        record.setdefault("matchReasons", [])
        record.setdefault("risks", [])


def _apply_jd_defaults(jd: dict[str, Any]) -> None:
    jd.setdefault("jdStatus", "JD Missing")
    for key in ("jdCoreResponsibilities", "jdDistinctiveKeywords", "jdUniqueRequirements", "jdInterviewSignals", "jdMustHave", "jdNiceToHave", "jdKeyOriginalExcerpt", "jdVersions"):
        jd.setdefault(key, [])
    jd.setdefault("jdRaw", "")
    jd.setdefault("jdSnapshot", jd.get("jdRaw", ""))
    jd.setdefault("jdSummary", "")
    jd.setdefault("interviewPackNeedsRefresh", False)


def _to_feishu_datetime(value: Any) -> str | None:
    text = str(value).strip()
    if not text:
        return None
    match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?", text)
    if not match:
        return None
    date_part, minute_part, second_part = match.groups()
    return f"{date_part} {minute_part or '00:00'}:{second_part or '00'}"


def _from_feishu_datetime(value: Any, date_only: bool) -> str:
    if isinstance(value, (int, float)):
        moment = datetime.fromtimestamp(value / 1000, SHANGHAI)
    else:
        text = str(value).replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(text)
            if moment.tzinfo is None:
                moment = moment.replace(tzinfo=SHANGHAI)
            moment = moment.astimezone(SHANGHAI)
        except ValueError:
            return str(value)[:10] if date_only else str(value)
    return moment.date().isoformat() if date_only else moment.isoformat(timespec="seconds")


def _unwrap_feishu_value(value: Any) -> Any:
    if isinstance(value, list):
        if value and all(isinstance(item, dict) for item in value):
            links = [item.get("link") for item in value if item.get("link")]
            if links:
                return links[0]
            texts = [str(item.get("text", "")) for item in value]
            if any(texts):
                return "".join(texts)
            if len(value) == 1:
                return value[0].get("name") or value[0].get("value")
        return value
    if isinstance(value, dict):
        return value.get("link") or value.get("text") or value.get("name") or value.get("value") or value
    if isinstance(value, str):
        markdown_link = re.fullmatch(r"\[[^\]]*\]\((https://[^)]+)\)", value.strip())
        if markdown_link:
            return markdown_link.group(1)
    return value
