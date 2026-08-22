from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from job_agent.filters import experience_filter, job_freshness_filter
from job_agent.models import Job
from job_agent.pipeline import deduplicate_job, existing_dedupe_keys, normalize_job
from job_agent.pipeline import run_recommendation_pipeline
from job_agent.validation import validate_job_active_status


def make_job(**overrides) -> Job:
    data = {
        "title": "HR Assistant",
        "company": "Example Listed Company",
        "location": "Hong Kong",
        "source": "JobsDB",
        "salary": "15-20K",
        "experience": "Entry level",
        "url": "https://hk.jobsdb.com/job/123",
        "foundDate": date.today().isoformat(),
        "postedDate": date.today().isoformat(),
        "jobDescription": "HR Operations and C&B support. Apply now.",
        "companySize": "listed company",
        "industry": "Technology",
    }
    data.update(overrides)
    return Job(**data)


def test_freshness() -> None:
    assert job_freshness_filter(make_job(postedDate=date.today().isoformat()))
    stale = make_job(postedDate=(date.today() - timedelta(days=61)).isoformat())
    assert not job_freshness_filter(stale)
    old = make_job(postedDate="2024-01-01")
    assert not job_freshness_filter(old)


def test_experience() -> None:
    assert experience_filter(make_job(experience="Entry level"))
    assert experience_filter(make_job(experience="1-3 years"))
    assert not experience_filter(make_job(experience="Around 4 years preferred"))
    assert not experience_filter(make_job(title="Senior HR Manager", experience="5 years"))


def test_dedupe() -> None:
    existing = existing_dedupe_keys(
        [
            {
                "title": "HR Assistant",
                "company": "Example Listed Company",
                "location": "Hong Kong",
                "source": "JobsDB",
                "salary": "15-20K",
                "experience": "Entry level",
                "url": "https://hk.jobsdb.com/job/123",
                "foundDate": "2026-07-12",
                "postedDate": "2026-07-12",
                "jobDescription": "",
                "companySize": "",
                "industry": "",
            }
        ]
    )
    seen: set[str] = set()
    assert not deduplicate_job(normalize_job(make_job()), seen, existing)
    assert deduplicate_job(normalize_job(make_job(url="https://hk.jobsdb.com/job/456")), seen, existing)


def test_active_status_with_user_verified() -> None:
    job = make_job(validation={"user_verified_active": "true", "source": "manual"})
    assert validate_job_active_status(job)
    assert job.activeStatus == "active"
    assert job.lastVerifiedAt
    assert job.validationSource == "manual"


def test_dashboard_unchanged() -> None:
    html = (ROOT / "work" / "hr-dashboard-2026-07-12-regression-fixed.html").read_text(encoding="utf-8")
    for token in [
        "main-tabs",
        'data-page="resume"',
        'data-page="jobs"',
        "jobDateTabs",
        "funnel",
        "todoList",
        "statusTabs",
        "copy-toast",
        "resumeClips",
    ]:
        assert token in html, token


class FakeAdapter:
    source_name = "JobsDB"

    def search(self) -> list[Job]:
        return [
            make_job(
                url="https://hk.jobsdb.com/job/good",
                validation={"user_verified": "true", "user_verified_active": "true", "source": "test"},
                postedDate=date.today().isoformat(),
                companySize="listed company",
                jobDescription="HR Operations C&B employee experience apply now",
            ),
            make_job(
                title="HR Assistant Four Years",
                url="https://hk.jobsdb.com/job/four-years",
                validation={"user_verified": "true", "user_verified_active": "true", "source": "test"},
                experience="Around 4 years preferred",
                postedDate=date.today().isoformat(),
                companySize="listed company",
                jobDescription="HR Operations apply now",
            ),
            make_job(
                title="Old HR Assistant",
                url="https://hk.jobsdb.com/job/old",
                validation={"user_verified": "true", "user_verified_active": "true", "source": "test"},
                postedDate="2024-01-01",
                companySize="listed company",
                jobDescription="HR Operations apply now",
            ),
            make_job(
                title="Duplicate HR Assistant",
                url="https://hk.jobsdb.com/job/duplicate",
                validation={"user_verified": "true", "user_verified_active": "true", "source": "test"},
                postedDate=date.today().isoformat(),
                companySize="listed company",
                jobDescription="HR Operations apply now",
            ),
        ]


def test_pipeline_report() -> None:
    existing = [
        {
            "title": "Duplicate HR Assistant",
            "company": "Example Listed Company",
            "location": "Hong Kong",
            "source": "JobsDB",
            "salary": "15-20K",
            "experience": "Entry level",
            "url": "https://hk.jobsdb.com/job/duplicate",
            "foundDate": "2026-07-12",
            "postedDate": date.today().isoformat(),
            "jobDescription": "HR Operations",
            "companySize": "listed company",
            "industry": "Technology",
        }
    ]
    result = run_recommendation_pipeline([FakeAdapter()], existing_jobs=existing)
    assert len(result.jobs) == 1
    report = result.report
    assert report.raw_count == 4
    assert report.duplicate_count == 1
    assert report.stale_job_count == 1
    assert report.experience_rejected_count == 1
    assert report.final_recommended_count == 1


if __name__ == "__main__":
    test_freshness()
    test_experience()
    test_dedupe()
    test_active_status_with_user_verified()
    test_dashboard_unchanged()
    test_pipeline_report()
    print("acceptance tests ok")
