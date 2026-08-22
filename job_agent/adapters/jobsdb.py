from __future__ import annotations

from job_agent.adapters.base import JobSource
from job_agent.models import Job


class JobsDBAdapter(JobSource):
    source_name = "JobsDB"

    def search(self) -> list[Job]:
        # JobsDB remains handled by the existing browser-based daily workflow.
        return []

