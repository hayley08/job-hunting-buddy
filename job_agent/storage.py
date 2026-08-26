from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from job_agent.models import Job
from job_agent.pipeline import job_dedupe_keys, normalize_job


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SHANGHAI = timezone(timedelta(hours=8), name="UTC+8")


@dataclass(slots=True)
class ImportResult:
    action: str
    job_id: str
    source_job_id: str
    title: str
    company: str
    url: str
    jd_hash: str
    opportunity_path: str
    jd_path: str
    history_path: str
    inbox_path: str

    def as_dict(self) -> dict[str, str]:
        return {
            "status": "success",
            "action": self.action,
            "jobId": self.job_id,
            "sourceJobId": self.source_job_id,
            "title": self.title,
            "company": self.company,
            "url": self.url,
            "jdHash": self.jd_hash,
            "opportunityPath": self.opportunity_path,
            "jdPath": self.jd_path,
            "historyPath": self.history_path,
            "inboxPath": self.inbox_path,
        }


def append_dashboard_jobs(path: Path, jobs: Iterable[Job], existing_jobs: list[dict[str, Any]]) -> None:
    """Write the legacy dashboard list used by the existing daily runner."""
    payload = [*existing_jobs, *(job.as_dashboard_dict() for job in jobs)]
    write_json(path, payload)


def save_single_url_import(job: Job, original_url: str, now: datetime | None = None) -> ImportResult:
    """Upsert one normalized Job into the existing V2 opportunity and JD stores."""
    job = normalize_job(job)
    if job.url != original_url.strip():
        raise ValueError("Importer changed the user-provided URL; refusing to save")
    if not job.title or not job.company or not job.jobDescription:
        raise ValueError("岗位名称、公司和完整 JD 均为必需字段")

    captured = (now or datetime.now(SHANGHAI)).astimezone(SHANGHAI)
    captured_at = captured.isoformat(timespec="seconds")
    import_date = captured.date().isoformat()

    opportunities_path = DATA / "opportunities.json"
    applications_path = DATA / "applications.json"
    historical_path = DATA / "historical-opportunities.json"
    archive_path = DATA / "archive.json"
    jds_path = DATA / "jds.json"
    history_path = DATA / "opportunity-history.json"
    daily_path = DATA / "daily" / "latest.json"

    opportunities = load_json_array(opportunities_path)
    applications = load_json_array(applications_path)
    historical = load_json_array(historical_path)
    archive_payload = load_json(archive_path, [])
    archive = archive_payload if isinstance(archive_payload, list) else archive_payload.get("records", [])
    jds = load_json_array(jds_path)
    history = load_json(history_path, {"schemaVersion": 1, "updatedAt": captured_at, "snapshots": []})

    collections = [opportunities, applications, historical, archive]
    duplicate = _find_duplicate(job, collections)
    changed_container: list[dict[str, Any]] | None = None
    if duplicate:
        container, record = duplicate
        changed_container = container
        canonical_job_id = str(record["jobId"])
        _update_existing_job_facts(record, job, original_url)
        action = "updated"
        if container is archive:
            archive_payload = archive if isinstance(archive_payload, list) else {**archive_payload, "records": archive}
    else:
        canonical_job_id = _canonical_job_id(job)
        opportunity = _build_opportunity(job, canonical_job_id, original_url, captured_at, import_date)
        _assert_schema_subset(opportunity, opportunities, "opportunity")
        opportunities.append(opportunity)
        action = "created"

    jd_record = _build_jd_record(job, canonical_job_id, original_url, captured_at)
    _assert_schema_subset(jd_record, jds, "JD")
    jd_action = _upsert_jd(jds, jd_record)
    if action == "updated" and jd_action == "unchanged":
        action = "duplicate_unchanged"

    _append_history_snapshot(history, canonical_job_id, captured_at, import_date)
    daily = load_json(daily_path, {})
    if isinstance(daily, dict):
        daily["dataUpdatedAt"] = captured_at

    source_job_id = job.jobId or "url-only"
    inbox_path = DATA / "inbox" / f"{import_date}_single-url-{_safe_token(source_job_id)}.json"
    inbox = {
        "inputDate": import_date,
        "receivedAt": captured_at,
        "processed": True,
        "processedAt": captured_at,
        "processedByRun": "SINGLE_URL_IMPORT",
        "originalUrl": original_url,
        "result": {
            "action": action,
            "jobId": canonical_job_id,
            "sourceJobId": job.jobId,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "postedDate": job.postedDate,
            "jdHash": jd_record["jdHash"],
        },
        "notes": [
            "The original user-provided URL is preserved exactly in the canonical job and JD records.",
            "The full raw JD was captured before any summary fields were generated.",
        ],
    }

    if duplicate is None or changed_container is opportunities:
        write_json(opportunities_path, opportunities)
    if changed_container is applications:
        write_json(applications_path, applications)
    if changed_container is historical:
        write_json(historical_path, historical)
    if changed_container is archive:
        write_json(archive_path, archive_payload)
    write_json(jds_path, jds)
    write_json(history_path, history)
    write_json(daily_path, daily)
    write_json(inbox_path, inbox)

    return ImportResult(
        action=action,
        job_id=canonical_job_id,
        source_job_id=job.jobId,
        title=job.title,
        company=job.company,
        url=original_url,
        jd_hash=jd_record["jdHash"],
        opportunity_path=_relative(opportunities_path),
        jd_path=_relative(jds_path),
        history_path=_relative(history_path),
        inbox_path=_relative(inbox_path),
    )


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_json_array(path: Path) -> list[dict[str, Any]]:
    payload = load_json(path, [])
    if not isinstance(payload, list):
        raise ValueError(f"{_relative(path)} must contain a JSON array")
    return payload


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _find_duplicate(
    job: Job, collections: Iterable[list[dict[str, Any]]]
) -> tuple[list[dict[str, Any]], dict[str, Any]] | None:
    incoming = job_dedupe_keys(job)
    for collection in collections:
        for record in collection:
            existing = normalize_job(
                Job(
                    title=record.get("title", ""),
                    company=record.get("company", ""),
                    location=record.get("location", ""),
                    source=record.get("source", ""),
                    salary=record.get("salary", ""),
                    experience=record.get("experience", ""),
                    url=_record_url(record),
                    foundDate=record.get("foundDate", ""),
                    postedDate=record.get("postedDate"),
                    jobDescription=record.get("jobDescription", ""),
                    companySize=record.get("companySize", ""),
                    industry=record.get("industry", ""),
                    jobId=record.get("sourceJobId") or record.get("jobId", ""),
                    canonicalUrl=record.get("canonicalUrl") or _record_url(record),
                )
            )
            if incoming & job_dedupe_keys(existing):
                return collection, record
    return None


def _build_opportunity(
    job: Job, canonical_job_id: str, original_url: str, captured_at: str, import_date: str
) -> dict[str, Any]:
    summary, responsibilities, requirements, keywords = _extract_jd_fields(job.jobDescription)
    campus_type = job.validation.get("campusType", "")
    job_category = job.validation.get("jobCategory", "")
    return {
        "jobId": canonical_job_id,
        "sourceJobId": job.jobId,
        "company": job.company,
        "title": job.title,
        "location": job.location,
        "market": "Mainland",
        "industry": job.industry,
        "jobFamily": _job_family(job.title, job.jobDescription, job_category),
        "campusType": campus_type,
        "classification": "OPEN" if job.activeStatus == "active" else "VERIFY",
        "currentStatus": "Saved",
        "source": f"{job.company}官方招聘",
        "sourcePriority": "P0",
        "sourceUrl": original_url,
        "applyUrl": original_url,
        "jdUrl": original_url,
        "officialUrl": original_url,
        "linkStatus": "VERIFIED" if job.validation.get("status") == "verified" else "UNVERIFIED",
        "postedDate": job.postedDate or "",
        "foundDate": job.foundDate or import_date,
        "foundAt": captured_at,
        "firstRecommendedAt": captured_at,
        "recommendationDate": import_date,
        "recommendationDates": [import_date],
        "salary": job.salary,
        "experience": job.experience,
        "matchScore": 0,
        "matchScoreBreakdown": {"candidateFit": 0, "entryBarrier": 0, "companyGrowth": 0, "freshnessValidity": 0},
        "matchReasons": [],
        "risks": ["单岗位 URL 导入只保存网页事实；尚未执行个性化匹配评分。"],
        "jdStatus": "Current JD",
        "jdSummary": summary,
    }


def _build_jd_record(
    job: Job, canonical_job_id: str, original_url: str, captured_at: str
) -> dict[str, Any]:
    raw = job.jobDescription.strip()
    jd_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    summary, responsibilities, requirements, keywords = _extract_jd_fields(raw)
    excerpts = [*responsibilities[:3], *requirements[:2]]
    nice_to_have = [line for line in requirements if re.search(r"优先|尤佳|preferred|plus", line, flags=re.I)]
    return {
        "jobId": canonical_job_id,
        "jdStatus": "Current JD",
        "jdRaw": raw,
        "jdSnapshot": raw,
        "jdCapturedAt": captured_at,
        "jdSource": "official-job-page",
        "jdUrl": original_url,
        "jdHash": jd_hash,
        "jdSummary": summary,
        "jdCoreResponsibilities": responsibilities,
        "jdDistinctiveKeywords": keywords,
        "jdUniqueRequirements": requirements,
        "jdInterviewSignals": [],
        "jdMustHave": requirements,
        "jdNiceToHave": nice_to_have,
        "jdKeyOriginalExcerpt": excerpts,
        "jdVersions": [{"capturedAt": captured_at, "hash": jd_hash, "source": "official-job-page"}],
        "interviewPackNeedsRefresh": True,
        "refreshReason": "new-jd-hash",
    }


def _upsert_jd(jds: list[dict[str, Any]], incoming: dict[str, Any]) -> str:
    existing = next((item for item in jds if item.get("jobId") == incoming["jobId"]), None)
    if not existing:
        jds.append(incoming)
        return "created"
    if existing.get("jdHash") == incoming["jdHash"]:
        existing["jdUrl"] = incoming["jdUrl"]
        return "unchanged"
    versions = [*existing.get("jdVersions", []), *incoming["jdVersions"]]
    existing.update(incoming)
    existing["jdVersions"] = versions
    existing["refreshReason"] = "changed-jd-hash"
    return "updated"


def _update_existing_job_facts(record: dict[str, Any], job: Job, original_url: str) -> None:
    updates = {
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "postedDate": job.postedDate or record.get("postedDate", ""),
        "sourceUrl": original_url,
        "applyUrl": original_url,
        "jdUrl": original_url,
        "officialUrl": original_url,
        "linkStatus": "VERIFIED" if job.validation.get("status") == "verified" else "UNVERIFIED",
        "jdStatus": "Current JD",
    }
    for key, value in updates.items():
        if key in record:
            record[key] = value


def _append_history_snapshot(history: dict[str, Any], job_id: str, captured_at: str, import_date: str) -> None:
    snapshots = history.setdefault("snapshots", [])
    snapshot = next((item for item in snapshots if item.get("recommendationDate") == import_date), None)
    if snapshot is None:
        snapshots.insert(
            0,
            {
                "recommendationDate": import_date,
                "capturedAt": captured_at,
                "runType": "SINGLE_URL_IMPORT",
                "jobIds": [job_id],
            },
        )
    elif job_id not in snapshot.setdefault("jobIds", []):
        snapshot["jobIds"].append(job_id)
    history["updatedAt"] = captured_at


def _extract_jd_fields(raw: str) -> tuple[str, list[str], list[str], list[str]]:
    description, requirement = raw, ""
    if "职位要求\n" in raw:
        description, requirement = raw.split("职位要求\n", 1)
    description = description.removeprefix("职位描述\n")
    responsibilities = _content_lines(description)
    requirements = _content_lines(requirement)
    summary_lines = [line.rstrip("；。") for line in (responsibilities[:2] or requirements[:2])]
    summary = "；".join(summary_lines)
    keyword_map = [
        ("HRBP", ["hrbp", "业务部门", "业务思维"]),
        ("Organization Development", ["组织发展", "组织诊断"]),
        ("Talent Development", ["人才培养", "人才评估", "能力素质模型"]),
        ("Performance", ["绩效"]),
        ("Compensation", ["薪酬"]),
        ("Employee Relations", ["员工关系"]),
        ("Headcount Planning", ["人力编制"]),
    ]
    lowered = raw.lower()
    keywords = [label for label, terms in keyword_map if any(term in lowered for term in terms)]
    return summary, responsibilities, requirements, keywords


def _content_lines(value: str) -> list[str]:
    lines: list[str] = []
    for raw_line in value.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        cleaned = re.sub(r"^[-•·]\s*", "", line)
        lines.append(cleaned)
    return lines


def _job_family(title: str, jd: str, category: str) -> str:
    text = f"{title}\n{jd}\n{category}".lower()
    labels = []
    for label, terms in [
        ("HRBP", ["hrbp", "业务部门"]),
        ("OD", ["组织发展"]),
        ("Talent Development", ["人才培养", "人才评估"]),
        ("Performance", ["绩效"]),
        ("C&B", ["薪酬"]),
        ("Employee Relations", ["员工关系"]),
    ]:
        if any(term in text for term in terms):
            labels.append(label)
    return " / ".join(labels) or category


def _canonical_job_id(job: Job) -> str:
    source_id = _safe_token(job.jobId) if job.jobId else hashlib.sha256(job.url.encode("utf-8")).hexdigest()[:16]
    return f"opp-single-url-{source_id}"


def _safe_token(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", str(value)).strip("-").lower() or "unknown"


def _record_url(record: dict[str, Any]) -> str:
    return record.get("canonicalUrl") or record.get("sourceUrl") or record.get("applyUrl") or record.get("jdUrl") or record.get("url", "")


def _assert_schema_subset(record: dict[str, Any], existing: list[dict[str, Any]], label: str) -> None:
    allowed = {key for item in existing for key in item}
    unexpected = set(record) - allowed
    if unexpected:
        raise ValueError(f"{label} importer attempted to add unsupported fields: {sorted(unexpected)}")


def _relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()
