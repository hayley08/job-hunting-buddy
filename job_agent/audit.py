from __future__ import annotations

import json
from pathlib import Path

from job_agent.filters import company_quality_filter, hayley_match_score, job_relevance_filter, salary_filter
from job_agent.models import Job
from job_agent.pipeline import normalize_job
from job_agent.validation import validate_job_record


def audit_jobs_file(input_path: Path, output_path: Path, discarded_path: Path) -> None:
    raw_jobs = json.loads(input_path.read_text(encoding="utf-8"))
    kept: list[dict] = []
    discarded: list[dict] = []

    for raw in raw_jobs:
        job = Job(
            title=raw.get("title", ""),
            company=raw.get("company", ""),
            location=raw.get("location", ""),
            source=raw.get("source", ""),
            salary=raw.get("salary", ""),
            experience=raw.get("experience", ""),
            url=raw.get("url", ""),
            foundDate=raw.get("foundDate", ""),
            postedDate=raw.get("postedDate"),
            jobDescription=raw.get("jobDescription", ""),
            companySize=raw.get("companySize", ""),
            industry=raw.get("industry", ""),
            matchScore=raw.get("matchScore", 0),
            matchReason=raw.get("matchReason", ""),
            why_recommended=raw.get("why_recommended", {}) or {},
            validation=raw.get("validation", {}) or {},
            risk=raw.get("risk", ""),
        )
        normalize_job(job)
        passed = (
            validate_job_record(job)
            and company_quality_filter(job)
            and salary_filter(job)
            and job_relevance_filter(job)
        )
        if passed:
            kept.append(hayley_match_score(job).as_dashboard_dict())
        else:
            item = raw | {"discardReason": job.risk}
            discarded.append(item)

    output_path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    discarded_path.write_text(json.dumps(discarded, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    audit_jobs_file(
        root / "data" / "jobs.json",
        root / "logs" / "jobs_quality_gate_passed.json",
        root / "logs" / "jobs_quality_gate_discarded.json",
    )
