from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from job_agent.adapters.base import JobSource
from job_agent.config import BOSS_CITY_CODES, BOSS_KEYWORDS_CN, BOSS_KEYWORDS_EN, BOSS_SEARCH_URL
from job_agent.models import Job, today_iso


@dataclass(slots=True)
class BossAdapterConfig:
    cookie_file: Path | None = None
    timeout_seconds: int = 20
    max_per_query: int = 30


class BossAdapter(JobSource):
    source_name = "BOSS"

    def __init__(self, config: BossAdapterConfig | None = None) -> None:
        self.config = config or BossAdapterConfig()

    def search(self) -> list[Job]:
        jobs: list[Job] = []
        for city_name, city_code in BOSS_CITY_CODES.items():
            for keyword in [*BOSS_KEYWORDS_CN, *BOSS_KEYWORDS_EN]:
                jobs.extend(self._search_query(city_name, city_code, keyword))
        return self._dedupe(jobs)

    def _search_query(self, city_name: str, city_code: str, keyword: str) -> list[Job]:
        url = BOSS_SEARCH_URL.format(city=city_code, query=quote(keyword))
        raw_payload = self._fetch_structured_payload(url)
        if not raw_payload:
            return []
        return [self._to_job(item, city_name, url) for item in raw_payload[: self.config.max_per_query]]

    def _fetch_structured_payload(self, url: str) -> list[dict[str, Any]]:
        """Prefer BOSS structured page/API state instead of scraping cards.

        BOSS often gates direct API access behind browser security checks. This
        method first looks for JSON app state embedded in the page. If a future
        browser runner captures XHR JSON, it can pass the same item shape into
        `_to_job` without changing pipeline logic.
        """
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://www.zhipin.com/",
        }
        cookie = self._read_cookie()
        if cookie:
            headers["Cookie"] = cookie
        try:
            html = urlopen(Request(url, headers=headers), timeout=self.config.timeout_seconds).read().decode(
                "utf-8", "ignore"
            )
        except Exception:
            return []

        if self._looks_blocked(html):
            return []

        return self._extract_json_jobs(html)

    def _extract_json_jobs(self, html: str) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for pattern in [
            r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>',
            r"window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*</script>",
            r"window\.__NUXT__\s*=\s*(\{.+?\})\s*</script>",
        ]:
            for match in re.finditer(pattern, html, flags=re.S):
                try:
                    payload = json.loads(match.group(1))
                except Exception:
                    continue
                candidates.extend(self._walk_for_jobs(payload))
        return candidates

    def _walk_for_jobs(self, node: Any) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        if isinstance(node, dict):
            keys = {key.lower() for key in node}
            if {"jobname", "brandname"} <= keys or {"jobname", "companyname"} <= keys:
                found.append(node)
            for value in node.values():
                found.extend(self._walk_for_jobs(value))
        elif isinstance(node, list):
            for item in node:
                found.extend(self._walk_for_jobs(item))
        return found

    def _to_job(self, item: dict[str, Any], city_name: str, fallback_url: str) -> Job:
        title = self._first(item, "jobName", "jobname", "title", "positionName")
        company = self._first(item, "brandName", "companyName", "brandname", "company")
        salary = self._first(item, "salaryDesc", "salary", "salaryDescText")
        experience = self._first(item, "jobExperience", "experienceName", "experience")
        area = self._first(item, "areaDistrict", "cityName", "locationName", "businessDistrict")
        description = self._first(item, "postDescription", "jobDesc", "description", "skills")
        size = self._first(item, "brandScaleName", "scaleName", "companySize")
        industry = self._first(item, "brandIndustry", "industryName", "industry")
        encrypt_job_id = self._first(item, "encryptJobId", "jobId", "lid")
        security_id = self._first(item, "securityId", "securityID")
        posted_date = self._first(item, "postDate", "publishDate", "refreshTime", "date", "updateTime")
        url = fallback_url
        if encrypt_job_id:
            url = f"https://www.zhipin.com/job_detail/{encrypt_job_id}.html"
            if security_id:
                url = f"{url}?securityId={security_id}"

        return Job(
            title=title,
            company=company,
            location=area or city_name,
            source="BOSS",
            salary=salary,
            experience=experience,
            url=url,
            foundDate=today_iso(),
            jobDescription=description,
            companySize=size,
            industry=industry,
            jobId=encrypt_job_id,
            canonicalUrl=url,
            postedDate=posted_date,
        )

    def _read_cookie(self) -> str:
        if not self.config.cookie_file or not self.config.cookie_file.exists():
            return ""
        return self.config.cookie_file.read_text(encoding="utf-8").strip()

    @staticmethod
    def _first(item: dict[str, Any], *keys: str) -> str:
        lowered = {key.lower(): value for key, value in item.items()}
        for key in keys:
            value = item.get(key, lowered.get(key.lower()))
            if value is None:
                continue
            if isinstance(value, list):
                return " ".join(str(v) for v in value if v)
            return str(value).strip()
        return ""

    @staticmethod
    def _looks_blocked(html: str) -> bool:
        lowered = html.lower()
        return any(marker in lowered for marker in ["captcha", "security check", "验证", "登录后", "安全", "safe"])

    @staticmethod
    def _dedupe(jobs: list[Job]) -> list[Job]:
        seen: set[tuple[str, str, str]] = set()
        unique: list[Job] = []
        for job in jobs:
            key = (job.title.lower(), job.company.lower(), job.location.lower())
            if key in seen:
                continue
            seen.add(key)
            unique.append(job)
        return unique
