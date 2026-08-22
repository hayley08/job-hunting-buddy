from __future__ import annotations

import re
from difflib import SequenceMatcher
from html import unescape
from datetime import date
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from job_agent.filters import append_risk
from job_agent.models import Job


SOURCE_DOMAINS = {
    "linkedin": ["linkedin.com"],
    "jobsdb": ["jobsdb.com"],
    "boss": ["zhipin.com"],
}


def validate_job_record(job: Job, fetch_timeout_seconds: int = 12) -> bool:
    if job.validation.get("user_verified") == "true":
        return True

    required = [job.title, job.company, job.location, job.salary, job.source, job.url]
    if not all(value and str(value).strip() for value in required):
        job.risk = append_risk(job.risk, "岗位核心字段不完整，无法验证记录绑定")
        return False

    if not _url_matches_source(job):
        job.risk = append_risk(job.risk, "岗位链接域名与来源平台不匹配")
        return False

    page_text = _fetch_page_text(job.url, fetch_timeout_seconds)
    if not page_text:
        if job.source.strip().lower() == "boss":
            job.validation["status"] = "needs_user_verification"
            job.risk = append_risk(job.risk, "BOSS 跳转安全验证页，需要 Hayley 手动验证")
        else:
            job.risk = append_risk(job.risk, "岗位链接无法打开或页面内容不可验证")
        return False

    if _looks_like_security_gate(page_text):
        job.validation["status"] = "needs_user_verification"
        job.risk = append_risk(job.risk, "页面进入安全验证/登录验证，需要 Hayley 手动验证")
        return False

    if not _text_matches(page_text, job.company):
        job.risk = append_risk(job.risk, "岗位链接页面公司名称与记录不匹配")
        return False

    if not _text_matches(page_text, job.title):
        job.risk = append_risk(job.risk, "岗位链接页面岗位名称与记录不匹配")
        return False

    return True


def validate_job_active_status(job: Job, fetch_timeout_seconds: int = 12) -> bool:
    if job.validation.get("user_verified_active") == "true":
        job.activeStatus = "active"
        job.lastVerifiedAt = date.today().isoformat()
        job.validationSource = job.validation.get("source", "user_verified")
        return True

    page_text, final_url = _fetch_page_text_and_url(job.url, fetch_timeout_seconds)
    if not page_text:
        job.activeStatus = "unverified"
        job.risk = append_risk(job.risk, "无法验证岗位仍在招聘")
        return False

    if _looks_like_search_home(job.url, final_url):
        job.activeStatus = "invalid_redirect"
        job.risk = append_risk(job.risk, "岗位链接跳转到搜索首页或平台首页")
        return False

    if _looks_closed(page_text):
        job.activeStatus = "closed"
        job.risk = append_risk(job.risk, "页面显示岗位已关闭/过期/停止招聘")
        return False

    if _looks_like_security_gate(page_text):
        job.activeStatus = "needs_user_verification"
        job.validation["status"] = "needs_user_verification"
        job.risk = append_risk(job.risk, "页面进入安全验证/登录验证，需要 Hayley 手动验证岗位仍开放")
        return False

    if not _looks_applyable(page_text):
        job.activeStatus = "unverified"
        job.risk = append_risk(job.risk, "页面未显示可申请入口，无法确认仍在招聘")
        return False

    job.activeStatus = "active"
    job.lastVerifiedAt = date.today().isoformat()
    job.validationSource = "job_detail_page"
    return True


def _url_matches_source(job: Job) -> bool:
    source = job.source.strip().lower()
    host = urlparse(job.url).netloc.lower()
    domains = SOURCE_DOMAINS.get(source)
    if not domains:
        return False
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def _fetch_page_text(url: str, timeout_seconds: int) -> str:
    text, _ = _fetch_page_text_and_url(url, timeout_seconds)
    return text


def _fetch_page_text_and_url(url: str, timeout_seconds: int) -> tuple[str, str]:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        response = urlopen(Request(url, headers=headers), timeout=timeout_seconds)
        raw = response.read(500_000)
        charset = response.headers.get_content_charset() or "utf-8"
        html = raw.decode(charset, "ignore")
    except Exception:
        return "", ""

    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip(), response.geturl()


def _text_matches(page_text: str, expected: str) -> bool:
    page = _normalize(page_text)
    target = _normalize(expected)
    if not target:
        return False
    if target in page:
        return True

    tokens = [token for token in re.split(r"[\s/|｜,，()（）·\-]+", target) if len(token) >= 2]
    if tokens and all(token in page for token in tokens[:4]):
        return True

    window = page[:12000]
    return SequenceMatcher(None, target, window).ratio() >= 0.62


def _normalize(value: str) -> str:
    return re.sub(r"[\W_]+", "", value.lower())


def _looks_like_security_gate(page_text: str) -> bool:
    lowered = page_text.lower()
    markers = [
        "安全验证",
        "security verification",
        "captcha",
        "验证",
        "登录后",
        "verify you are human",
    ]
    return any(marker in lowered for marker in markers)


def _looks_closed(page_text: str) -> bool:
    lowered = page_text.lower()
    markers = [
        "已停止招聘",
        "已关闭",
        "已过期",
        "职位已关闭",
        "职位已过期",
        "岗位不存在",
        "职位不存在",
        "position closed",
        "no longer accepting applications",
        "job expired",
        "job unavailable",
        "job no longer available",
        "this job is no longer available",
        "not accepting applications",
    ]
    return any(marker in lowered for marker in markers)


def _looks_applyable(page_text: str) -> bool:
    lowered = page_text.lower()
    markers = [
        "apply",
        "apply now",
        "easy apply",
        "申请",
        "立即申请",
        "投递",
        "立即投递",
        "我要应聘",
        "send application",
    ]
    return any(marker in lowered for marker in markers)


def _looks_like_search_home(original_url: str, final_url: str) -> bool:
    if not final_url:
        return False
    original = urlparse(original_url)
    final = urlparse(final_url)
    if original.netloc and final.netloc and original.netloc != final.netloc:
        return True
    path = final.path.rstrip("/").lower()
    if path in {"", "/", "/jobs", "/web/geek/jobs"}:
        return True
    if "search" in path and "job" not in path:
        return True
    return False
