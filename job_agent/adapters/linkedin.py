from __future__ import annotations

from job_agent.adapters.base import JobSource
from job_agent.models import Job


class LinkedInAdapter(JobSource):
    source_name = "LinkedIn"

    def search(self) -> list[Job]:
        # Existing LinkedIn search logic is intentionally left in the daily
        # automation/browser flow. This adapter is the stable extension point.
        return []

