from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


@dataclass(slots=True)
class RawJob:
    title: str
    company: str
    location: str
    source: str
    url: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Job:
    title: str
    company: str
    location: str
    source: str
    salary: str
    experience: str
    url: str
    foundDate: str
    jobDescription: str
    companySize: str
    industry: str
    jobId: str = ""
    canonicalUrl: str = ""
    matchScore: int = 0
    matchReason: str = ""
    recommendation_reason: str = ""
    why_recommended: dict[str, str] = field(default_factory=dict)
    validation: dict[str, str] = field(default_factory=dict)
    risk: str = ""
    postedDate: str | None = None
    lastVerifiedAt: str = ""
    activeStatus: str = ""
    validationSource: str = ""

    def as_dashboard_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "source": self.source,
            "salary": self.salary,
            "experience": self.experience,
            "url": self.url,
            "foundDate": self.foundDate,
            "postedDate": self.postedDate,
            "lastVerifiedAt": self.lastVerifiedAt,
            "activeStatus": self.activeStatus,
            "validationSource": self.validationSource,
            "jobDescription": self.jobDescription,
            "companySize": self.companySize,
            "industry": self.industry,
            "jobId": self.jobId,
            "canonicalUrl": self.canonicalUrl,
            "matchScore": self.matchScore,
            "matchReason": self.matchReason,
            "recommendation_reason": self.recommendation_reason,
            "why_recommended": self.why_recommended,
            "validation": self.validation,
            "risk": self.risk,
        }


def today_iso() -> str:
    return date.today().isoformat()
