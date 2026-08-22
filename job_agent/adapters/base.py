from __future__ import annotations

from abc import ABC, abstractmethod

from job_agent.models import Job


class JobSource(ABC):
    source_name: str

    @abstractmethod
    def search(self) -> list[Job]:
        """Search the source and return normalized jobs."""

