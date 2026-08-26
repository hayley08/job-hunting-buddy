from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from urllib.parse import urlparse

from job_agent.adapters.base import JobSource
from job_agent.filters import (
    company_quality_filter,
    experience_filter,
    hayley_match_score,
    job_freshness_filter,
    job_relevance_filter,
    salary_filter,
)
from job_agent.models import Job
from job_agent.validation import validate_job_active_status, validate_job_record


@dataclass(slots=True)
class PipelineReport:
    source_counts: dict[str, int] = field(default_factory=dict)
    raw_count: int = 0
    invalid_link_count: int = 0
    closed_job_count: int = 0
    stale_job_count: int = 0
    duplicate_count: int = 0
    experience_rejected_count: int = 0
    company_rejected_count: int = 0
    salary_rejected_count: int = 0
    role_rejected_count: int = 0
    final_recommended_count: int = 0
    discarded: list[dict[str, str]] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "source_counts": self.source_counts,
            "raw_count": self.raw_count,
            "invalid_link_count": self.invalid_link_count,
            "closed_job_count": self.closed_job_count,
            "stale_job_count": self.stale_job_count,
            "duplicate_count": self.duplicate_count,
            "experience_rejected_count": self.experience_rejected_count,
            "company_rejected_count": self.company_rejected_count,
            "salary_rejected_count": self.salary_rejected_count,
            "role_rejected_count": self.role_rejected_count,
            "final_recommended_count": self.final_recommended_count,
            "discarded": self.discarded,
        }


@dataclass(slots=True)
class PipelineResult:
    jobs: list[Job]
    report: PipelineReport


def search_job_sources(adapters: Iterable[JobSource]) -> list[Job]:
    jobs: list[Job] = []
    for adapter in adapters:
        jobs.extend(adapter.search())
    return jobs


def search_job_sources_with_counts(adapters: Iterable[JobSource]) -> tuple[list[Job], dict[str, int]]:
    jobs: list[Job] = []
    counts: dict[str, int] = {}
    for adapter in adapters:
        source_jobs = adapter.search()
        source_name = getattr(adapter, "source_name", adapter.__class__.__name__)
        counts[source_name] = len(source_jobs)
        jobs.extend(source_jobs)
    return jobs, counts


def normalize_job(job: Job) -> Job:
    job.title = job.title.strip()
    job.company = job.company.strip()
    job.location = job.location.strip()
    job.salary = job.salary.strip()
    job.experience = job.experience.strip()
    job.url = job.url.strip()
    job.canonicalUrl = (job.canonicalUrl or job.url).strip()
    job.jobId = job.jobId.strip()
    job.jobDescription = job.jobDescription.strip()
    job.companySize = job.companySize.strip()
    job.industry = job.industry.strip()
    return job


def deduplicate_job(job: Job, seen: set[str], existing: set[str]) -> bool:
    keys = job_dedupe_keys(job)
    if keys & seen or keys & existing:
        return False
    seen.update(keys)
    return True


def job_dedupe_key(job: Job) -> str:
    """Return the highest-priority identity key for backwards compatibility."""
    keys = job_dedupe_keys(job)
    for prefix in ("id|", "url|", "sig|"):
        match = next((key for key in keys if key.startswith(prefix)), None)
        if match:
            return match
    return "sig|||"


def job_dedupe_keys(job: Job) -> set[str]:
    """Return every usable identity key in the repository's priority order.

    Keeping all keys prevents a record with a source id from bypassing an
    already-saved record that has the same canonical URL or signature.
    """
    keys: set[str] = set()
    source = _normalized_text(job.source)
    if job.jobId:
        keys.add(f"id|{source}|{job.jobId.strip().lower()}")
    parsed = urlparse(job.canonicalUrl or job.url)
    path = parsed.path.rstrip("/").lower()
    if parsed.netloc and path:
        keys.add(f"url|{parsed.netloc.lower()}{path}")
    normalized_title = _normalized_text(job.title)
    normalized_company = _normalized_text(job.company)
    normalized_location = _normalized_text(job.location)
    if normalized_title and normalized_company:
        keys.add(f"sig|{normalized_company}|{normalized_title}|{normalized_location}")
    return keys


def _normalized_text(value: str) -> str:
    return " ".join(str(value or "").lower().split())


def existing_dedupe_keys(existing_jobs: Iterable[dict]) -> set[str]:
    keys: set[str] = set()
    for raw in existing_jobs:
        job = Job(
            title=raw.get("title", ""),
            company=raw.get("company", ""),
            location=raw.get("location", ""),
            source=raw.get("source", ""),
            salary=raw.get("salary", ""),
            experience=raw.get("experience", ""),
            url=raw.get("url") or raw.get("sourceUrl") or raw.get("applyUrl") or raw.get("jdUrl", ""),
            foundDate=raw.get("foundDate", ""),
            jobDescription=raw.get("jobDescription", ""),
            companySize=raw.get("companySize", ""),
            industry=raw.get("industry", ""),
            jobId=raw.get("sourceJobId") or raw.get("jobId", ""),
            canonicalUrl=raw.get("canonicalUrl") or raw.get("sourceUrl") or raw.get("applyUrl") or raw.get("jdUrl") or raw.get("url", ""),
            postedDate=raw.get("postedDate"),
        )
        keys.update(job_dedupe_keys(normalize_job(job)))
    return keys


def run_recommendation_pipeline(adapters: Iterable[JobSource], existing_jobs: Iterable[dict] = ()) -> PipelineResult:
    raw_jobs, source_counts = search_job_sources_with_counts(adapters)
    report = PipelineReport(source_counts=source_counts, raw_count=len(raw_jobs))
    normalized = [normalize_job(job) for job in raw_jobs]
    filtered: list[Job] = []
    seen: set[str] = set()
    existing = existing_dedupe_keys(existing_jobs)
    for job in normalized:
        if not deduplicate_job(job, seen, existing):
            report.duplicate_count += 1
            _discard(report, job, "duplicate")
            continue
        if not validate_job_record(job):
            report.invalid_link_count += 1
            _discard(report, job, "invalid_link")
            continue
        if not validate_job_active_status(job):
            report.closed_job_count += 1
            _discard(report, job, "closed_or_unverified")
            continue
        if not job_freshness_filter(job):
            report.stale_job_count += 1
            _discard(report, job, "stale")
            continue
        if not experience_filter(job):
            report.experience_rejected_count += 1
            _discard(report, job, "experience")
            continue
        if not company_quality_filter(job):
            report.company_rejected_count += 1
            _discard(report, job, "company")
            continue
        if not salary_filter(job):
            report.salary_rejected_count += 1
            _discard(report, job, "salary")
            continue
        if not job_relevance_filter(job):
            report.role_rejected_count += 1
            _discard(report, job, "role")
            continue
        scored = hayley_match_score(job)
        if not scored.matchReason or not scored.why_recommended:
            report.role_rejected_count += 1
            _discard(report, job, "missing_reason")
            continue
        filtered.append(scored)
    jobs = sorted(filtered, key=lambda j: j.matchScore, reverse=True)[:5]
    report.final_recommended_count = len(jobs)
    return PipelineResult(jobs=jobs, report=report)


def recommend_jobs(adapters: Iterable[JobSource]) -> list[Job]:
    return run_recommendation_pipeline(adapters).jobs


def _discard(report: PipelineReport, job: Job, stage: str) -> None:
    report.discarded.append(
        {
            "stage": stage,
            "source": job.source,
            "company": job.company,
            "title": job.title,
            "url": job.url,
            "risk": job.risk,
        }
    )
