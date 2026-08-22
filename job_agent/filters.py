from __future__ import annotations

import re
from datetime import date, datetime

from job_agent.config import (
    BLOCKED_JOB_TERMS,
    CORE_BONUS_TERMS,
    CORE_HR_TERMS,
    EARLY_CAREER_TERMS,
    PREMIUM_COMPANY_TERMS,
    QUALITY_MARKERS,
    SENIOR_EXPERIENCE_TERMS,
)
from job_agent.models import Job


def _blob(job: Job) -> str:
    return " ".join(
        [
            job.title,
            job.company,
            job.location,
            job.salary,
            job.experience,
            job.jobDescription,
            job.companySize,
            job.industry,
        ]
    ).lower()


def company_quality_filter(job: Job) -> bool:
    text = _blob(job)
    if any(term.lower() in text for term in PREMIUM_COMPANY_TERMS):
        job.why_recommended["company_quality"] = "命中大厂/500强/头部公司名单"
        return True
    if any(marker.lower() in text for marker in QUALITY_MARKERS):
        job.why_recommended["company_quality"] = "公司规模或行业地位可验证"
        return True
    job.risk = append_risk(job.risk, "公司规模/质量无法确认，按规则不推荐")
    return False


def salary_filter(job: Job) -> bool:
    salary = job.salary.lower().replace(" ", "")
    if not salary or "面议" in salary or "未知" in salary or "notlisted" in salary or "negotiable" in salary:
        job.risk = append_risk(job.risk, "薪资未列出，需要投递前确认")
        job.why_recommended["salary_match"] = "薪资未列出，不作为硬丢弃项，投递前需确认"
        return True

    nums = [int(n) for n in re.findall(r"(\d+)\s*k", salary, flags=re.I)]
    if not nums:
        nums = [int(n) for n in re.findall(r"(\d+)", salary)]
    if not nums:
        job.risk = append_risk(job.risk, "无法解析薪资，需要投递前确认")
        job.why_recommended["salary_match"] = "薪资格式无法解析，不作为硬丢弃项，投递前需确认"
        return True

    lower = min(nums)
    upper = max(nums)
    if lower < 12 and not (lower == 10 and upper >= 20):
        job.risk = append_risk(job.risk, f"薪资区间 {job.salary} 低于推荐标准")
        return False
    job.why_recommended["salary_match"] = f"{job.salary} 满足薪资要求"
    return True


def job_freshness_filter(job: Job, max_age_days: int = 60) -> bool:
    posted = parse_posted_date(job.postedDate or "")
    if not posted:
        job.risk = append_risk(job.risk, "postedDate 缺失或不可验证")
        return False

    today = date.today()
    if posted.year != today.year:
        job.risk = append_risk(job.risk, f"发布日期 {posted.isoformat()} 不是当前年份")
        return False
    age_days = (today - posted).days
    if age_days < 0:
        job.risk = append_risk(job.risk, f"发布日期 {posted.isoformat()} 在未来，数据异常")
        return False
    if age_days > max_age_days:
        job.risk = append_risk(job.risk, f"发布日期超过 {max_age_days} 天")
        return False
    job.why_recommended["freshness_match"] = f"发布于 {posted.isoformat()}，{age_days} 天内"
    return True


def parse_posted_date(value: str) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            pass
    match = re.search(r"(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})", text)
    if match:
        year, month, day = map(int, match.groups())
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def experience_filter(job: Job) -> bool:
    text = _blob(job)
    experience_text = " ".join([job.experience, job.title, job.jobDescription]).lower()

    if any(term.lower() in experience_text for term in SENIOR_EXPERIENCE_TERMS):
        job.risk = append_risk(job.risk, "经验要求超过 early-career 目标")
        return False

    ranges = re.findall(r"(\d+)\s*[-–—]\s*(\d+)\s*(?:year|years|yr|yrs|年)", text, flags=re.I)
    for start, end in ranges:
        start_i = int(start)
        end_i = int(end)
        if start_i >= 3 or end_i > 3:
            job.risk = append_risk(job.risk, f"经验要求 {start}-{end} 年超过目标")
            return False
        job.why_recommended["experience_match"] = f"经验要求 {start}-{end} 年可接受"
        return True

    minimums = re.findall(r"(?:minimum|min\.?|at least|至少|不少于)\s*(\d+)\s*(?:year|years|yr|yrs|年)", text, flags=re.I)
    for value in minimums:
        years = int(value)
        if years >= 3:
            job.risk = append_risk(job.risk, f"经验要求至少 {years} 年，超过 early-career 目标")
            return False
        job.why_recommended["experience_match"] = f"经验要求至少 {years} 年，可接受"
        return True

    standalone_years = re.findall(r"(\d+)\s*(?:year|years|yr|yrs|年)", experience_text, flags=re.I)
    if standalone_years:
        years = max(int(value) for value in standalone_years)
        if years > 3:
            job.risk = append_risk(job.risk, f"经验要求 {years} 年超过目标")
            return False
        job.why_recommended["experience_match"] = f"经验要求 {years} 年可接受"
        return True

    if any(term.lower() in experience_text for term in EARLY_CAREER_TERMS):
        job.why_recommended["experience_match"] = "经验要求符合 early-career / graduate / assistant / associate 目标"
        return True

    if any(term in experience_text for term in ["hr assistant", "assistant human resources", "human resources assistant"]):
        job.why_recommended["experience_match"] = "Assistant 岗位，默认符合 early-career 目标"
        return True

    job.risk = append_risk(job.risk, "经验要求无法确认，不能进入推荐")
    return False


def job_relevance_filter(job: Job) -> bool:
    text = _blob(job)
    if any(term.lower() in text for term in BLOCKED_JOB_TERMS):
        job.risk = append_risk(job.risk, "命中招聘/admin/销售/保险代理等过滤词")
        return False

    matched_terms = [term for term in CORE_HR_TERMS if term.lower() in text]
    strong_terms = [
        term
        for term in matched_terms
        if term.lower()
        not in {
            "hr",
            "learning",
            "benefits",
        }
    ]
    if not strong_terms:
        job.risk = append_risk(job.risk, "岗位方向不够贴近 HRBP/COE/C&B/OD/L&D/HR Ops 等核心 HR")
        return False

    job.why_recommended["role_match"] = "命中核心 HR 方向：" + ", ".join(strong_terms[:4])
    return True


def job_match_filter(job: Job) -> bool:
    return job_relevance_filter(job)


def hayley_match_score(job: Job) -> Job:
    text = _blob(job)
    score = 0
    reasons: list[str] = []

    if company_quality_filter(job):
        score += 3
        reasons.append("公司质量可接受")
    if any(term.lower() in text for term in CORE_HR_TERMS):
        score += 4
        reasons.append("岗位方向贴合 HR Ops/HRBP/COE/C&B/OD/L&D")
    if any(term in text for term in ["0-3", "1-3", "1-5", "应届", "校招", "intern", "assistant", "associate", "specialist"]):
        score += 2
        reasons.append("经验门槛可尝试")
    elif not any(term in text for term in ["5年以上", "8年以上", "manager", "director", "负责人"]):
        score += 1
        reasons.append("经验要求未明显过高")
    if job.postedDate:
        score += 1
        reasons.append("发布日期可确认")
    if any(term.lower() in text for term in PREMIUM_COMPANY_TERMS):
        score += 1
        reasons.append("大厂/500强/头部公司加分")
    if any(term.lower() in text for term in CORE_BONUS_TERMS):
        score += 1
        reasons.append("命中 HRBP/COE/C&B/OD 核心方向")

    if not all(
        job.why_recommended.get(key)
        for key in ["company_quality", "role_match", "salary_match", "experience_match", "freshness_match"]
    ):
        job.risk = append_risk(job.risk, "推荐原因不完整")
        job.matchScore = 0
        job.matchReason = ""
        return job

    job.matchScore = score
    job.matchReason = "；".join(reasons)
    job.recommendation_reason = job.matchReason
    return job


def append_risk(existing: str, risk: str) -> str:
    return f"{existing}；{risk}" if existing else risk
