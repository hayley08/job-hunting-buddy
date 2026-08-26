from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from job_agent.adapters.base import JobSource
from job_agent.models import Job, today_iso


class JobImportError(RuntimeError):
    """A user-facing failure that must not be replaced with inferred data."""


class _ScriptCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.scripts: list[tuple[dict[str, str], str]] = []
        self._attrs: dict[str, str] | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "script":
            self._attrs = {key.lower(): value or "" for key, value in attrs}
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._attrs is not None:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._attrs is not None:
            self.scripts.append((self._attrs, "".join(self._parts)))
            self._attrs = None
            self._parts = []


class SingleUrlAdapter(JobSource):
    """Fetch exactly one user-provided job URL into the existing Job model."""

    source_name = "Single URL"

    def __init__(self, url: str, timeout_seconds: int = 25) -> None:
        parsed = urlparse(url.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise JobImportError("岗位 URL 必须是完整的 http/https 链接")
        self.url = url.strip()
        self.timeout_seconds = timeout_seconds

    def search(self) -> list[Job]:
        html = self._fetch_text(self.url)
        parsed = urlparse(self.url)
        if parsed.hostname and parsed.hostname.endswith(".jobs.feishu.cn"):
            return [self._parse_feishu_job(html)]
        return [self._parse_json_ld_job(html)]

    def _parse_feishu_job(self, html: str) -> Job:
        parsed = urlparse(self.url)
        match = re.search(r"/position/(\d+)/detail(?:/|$)", parsed.path)
        if not match:
            raise JobImportError("飞书招聘 URL 中未找到 position id")
        source_job_id = match.group(1)
        api_url = f"{parsed.scheme}://{parsed.netloc}/api/v1/job/posts/{source_job_id}"
        payload = self._fetch_json(api_url)
        detail = payload.get("data", {}).get("job_post_detail")
        if payload.get("code") != 0 or not isinstance(detail, dict):
            message = payload.get("message") or payload.get("error") or "职位详情 API 未返回岗位"
            raise JobImportError(f"飞书招聘页面抓取失败：{message}")

        title = _text(detail.get("title"))
        description = _text(detail.get("description"))
        requirement = _text(detail.get("requirement"))
        if not title:
            raise JobImportError("飞书招聘页面未返回岗位名称")
        if not description and not requirement:
            raise JobImportError("飞书招聘页面未返回职位描述或职位要求")

        site_info = _website_info(html)
        company = _text(site_info.get("tenant_info", {}).get("tenant_name"))
        if not company:
            raise JobImportError("飞书招聘页面未返回公司名称")

        cities = [
            _text(item.get("name") or item.get("i18n_name"))
            for item in detail.get("city_list", [])
            if isinstance(item, dict)
        ]
        location = "/".join(value for value in cities if value) or "未披露"
        category = detail.get("job_category") or {}
        industry = _root_category_name(category) or _text(category.get("name"))
        recruit_type = detail.get("recruit_type") or {}
        campus_type = " / ".join(
            value
            for value in [
                _text((recruit_type.get("parent") or {}).get("name")),
                _text(recruit_type.get("name")),
            ]
            if value
        )
        posted_date = _unix_milliseconds_to_date(detail.get("publish_time"))
        experience = _infer_experience(title, requirement)
        jd_raw = _join_jd(description, requirement)
        active = detail.get("channel_online_status") == 1

        return Job(
            title=title,
            company=company,
            location=location,
            source=parsed.netloc.lower(),
            salary="未披露",
            experience=experience,
            url=self.url,
            foundDate=today_iso(),
            postedDate=posted_date,
            jobDescription=jd_raw,
            companySize="",
            industry=industry,
            jobId=_text(detail.get("id")) or source_job_id,
            canonicalUrl=self.url,
            lastVerifiedAt=today_iso(),
            activeStatus="active" if active else "unverified",
            validationSource="official_api",
            validation={
                "status": "verified" if active else "unverified",
                "source": "official_api",
                "campusType": campus_type,
                "jobCategory": _text(category.get("name")),
            },
            risk="" if active else "页面未确认岗位仍在线",
        )

    def _parse_json_ld_job(self, html: str) -> Job:
        collector = _ScriptCollector()
        collector.feed(html)
        candidates: list[dict[str, Any]] = []
        for attrs, raw in collector.scripts:
            if "ld+json" not in attrs.get("type", "").lower():
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            candidates.extend(_find_job_postings(payload))
        if not candidates:
            raise JobImportError("页面没有可识别的 JobPosting 结构化数据；未保存任何编造内容")

        detail = candidates[0]
        title = _text(detail.get("title") or detail.get("name"))
        organization = detail.get("hiringOrganization") or {}
        company = _text(organization.get("name")) if isinstance(organization, dict) else ""
        jd_raw = _html_to_text(_text(detail.get("description")))
        if not title or not company or not jd_raw:
            missing = [name for name, value in [("岗位名称", title), ("公司", company), ("JD", jd_raw)] if not value]
            raise JobImportError("JobPosting 缺少必需字段：" + "、".join(missing))

        parsed = urlparse(self.url)
        identifier = detail.get("identifier") or {}
        source_job_id = _text(identifier.get("value")) if isinstance(identifier, dict) else _text(identifier)
        location = _json_ld_location(detail.get("jobLocation")) or "未披露"
        posted_date = _text(detail.get("datePosted"))[:10] or None
        experience = _text(detail.get("experienceRequirements")) or _infer_experience(title, jd_raw)
        return Job(
            title=title,
            company=company,
            location=location,
            source=parsed.netloc.lower(),
            salary=_json_ld_salary(detail.get("baseSalary")) or "未披露",
            experience=experience,
            url=self.url,
            foundDate=today_iso(),
            postedDate=posted_date,
            jobDescription=jd_raw,
            companySize="",
            industry=_text(detail.get("industry")),
            jobId=source_job_id,
            canonicalUrl=self.url,
            lastVerifiedAt=today_iso(),
            activeStatus="active",
            validationSource="json_ld",
            validation={"status": "verified", "source": "json_ld"},
        )

    def _fetch_text(self, url: str) -> str:
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; CampusJobSearchOS/2.0)",
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read(2_000_000)
                charset = response.headers.get_content_charset() or "utf-8"
                return raw.decode(charset, "ignore")
        except HTTPError as error:
            raise JobImportError(f"网页返回 HTTP {error.code}") from error
        except URLError as error:
            raise JobImportError(f"无法连接岗位网页：{error.reason}") from error
        except TimeoutError as error:
            raise JobImportError("访问岗位网页超时") from error

    def _fetch_json(self, url: str) -> dict[str, Any]:
        raw = self._fetch_text(url)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            raise JobImportError("岗位详情接口未返回有效 JSON") from error
        if not isinstance(payload, dict):
            raise JobImportError("岗位详情接口返回了意外的数据格式")
        return payload


def _website_info(html: str) -> dict[str, Any]:
    collector = _ScriptCollector()
    collector.feed(html)
    for attrs, raw in collector.scripts:
        if attrs.get("id", "").lower() != "js-websiteinfo":
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}
    return {}


def _find_job_postings(node: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(node, dict):
        raw_type = node.get("@type")
        types = raw_type if isinstance(raw_type, list) else [raw_type]
        if any(str(value).lower() == "jobposting" for value in types):
            found.append(node)
        for value in node.values():
            found.extend(_find_job_postings(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_find_job_postings(item))
    return found


def _join_jd(description: str, requirement: str) -> str:
    sections: list[str] = []
    if description:
        sections.append("职位描述\n" + description.strip())
    if requirement:
        sections.append("职位要求\n" + requirement.strip())
    return "\n\n".join(sections)


def _root_category_name(category: dict[str, Any]) -> str:
    current = category
    last = ""
    while isinstance(current, dict) and current:
        last = _text(current.get("name")) or last
        current = current.get("parent") or {}
    return last


def _unix_milliseconds_to_date(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).date().isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _infer_experience(title: str, text: str) -> str:
    combined = f"{title}\n{text}"
    cohort = "2027届" if re.search(r"(?:27届|2027届)", combined, flags=re.I) else ""
    degree_match = re.search(r"(?:统招)?(?:本科|硕士|博士)(?:及以上)?", combined)
    degree = degree_match.group(0) if degree_match else ""
    values = [value for value in [cohort, degree] if value]
    return "，".join(values) or "未披露"


def _html_to_text(value: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = re.sub(r"</(?:p|li|div|h\d)>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text).replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _json_ld_location(value: Any) -> str:
    items = value if isinstance(value, list) else [value]
    locations: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        address = item.get("address") or {}
        if isinstance(address, str):
            locations.append(address)
            continue
        if isinstance(address, dict):
            parts = [_text(address.get(key)) for key in ("addressLocality", "addressRegion", "addressCountry")]
            rendered = ", ".join(part for part in parts if part)
            if rendered:
                locations.append(rendered)
    return "/".join(locations)


def _json_ld_salary(value: Any) -> str:
    if not isinstance(value, dict):
        return _text(value)
    currency = _text(value.get("currency"))
    raw = value.get("value") or {}
    if isinstance(raw, dict):
        minimum = _text(raw.get("minValue"))
        maximum = _text(raw.get("maxValue"))
        unit = _text(raw.get("unitText"))
        amount = "-".join(part for part in [minimum, maximum] if part)
        return " ".join(part for part in [currency, amount, unit] if part)
    return " ".join(part for part in [currency, _text(raw)] if part)


def _text(value: Any) -> str:
    return str(value or "").strip()
