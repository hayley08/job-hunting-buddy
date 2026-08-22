from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOW = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00")


def read_json(path: str, fallback):
    file = ROOT / path
    if not file.exists():
        return fallback
    return json.loads(file.read_text(encoding="utf-8"))


def write_json(path: str, data) -> None:
    file = ROOT / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", value.strip().lower())
    return text.strip("-")[:80] or "unknown"


def job_id(prefix: str, company: str, title: str, date: str) -> str:
    return f"{prefix}-{slug(company)}-{slug(title)}-{date or 'unknown'}"


def migrate_archive(old_jobs: list[dict]) -> dict:
    archived_jobs = []
    duplicates = []
    seen = set()
    for job in old_jobs:
        key = "|".join(
            [
                str(job.get("source", "")).lower(),
                str(job.get("url", "")).lower(),
                str(job.get("company", "")).lower(),
                str(job.get("title", "")).lower(),
                str(job.get("location", "")).lower(),
            ]
        )
        item = {
            "jobId": job_id("hk", job.get("company", ""), job.get("title", ""), job.get("foundDate", "")),
            "company": job.get("company", ""),
            "title": job.get("title", ""),
            "location": job.get("location", ""),
            "industry": job.get("industry", ""),
            "market": "HongKong",
            "source": job.get("source", ""),
            "sourceJobId": job.get("jobId", ""),
            "jdUrl": job.get("url", ""),
            "applyUrl": job.get("url", ""),
            "foundDate": job.get("foundDate", ""),
            "postedDate": job.get("postedDate", ""),
            "salary": job.get("salary", ""),
            "experience": job.get("experience", ""),
            "jobDescription": job.get("jobDescription", ""),
            "matchScore": job.get("matchScore", 0),
            "matchReasons": [job.get("matchReason", "")] if job.get("matchReason") else [],
            "risks": [job.get("risk", "")] if job.get("risk") else [],
            "currentStatus": "Archived",
            "statusHistory": [
                {
                    "status": "Archived",
                    "date": NOW[:10],
                    "sourceOfTruth": "migration",
                    "notes": "Hong Kong historical recommendation archived during Campus OS V2 migration."
                }
            ],
            "sourceOfTruth": "migration",
            "archived": True,
            "notes": "Migrated from HR dashboard historical Hong Kong data."
        }
        if key in seen:
            duplicates.append(item)
        else:
            seen.add(key)
            archived_jobs.append(item)
    return {
        "market": "HongKong",
        "archived": True,
        "records": archived_jobs,
        "duplicates": duplicates
    }


def migrate_applications(old_applications: dict) -> list[dict]:
    records = old_applications.get("records", [])
    migrated = []
    for record in records:
        applied_date = record.get("appliedDate", "")
        status = "Applied" if record.get("status") == "applied" else record.get("status", "Saved")
        migrated.append(
            {
                "jobId": job_id("app", record.get("company", ""), record.get("title", ""), applied_date),
                "company": record.get("company", ""),
                "title": record.get("title", ""),
                "businessUnit": "",
                "location": record.get("location", "Hong Kong"),
                "industry": "",
                "market": "HongKong",
                "source": record.get("source", ""),
                "sourceJobId": "",
                "jdUrl": record.get("url", ""),
                "applyUrl": record.get("url", ""),
                "officialUrl": "",
                "foundDate": record.get("foundDate", ""),
                "postedDate": record.get("postedDate", ""),
                "appliedDate": applied_date,
                "deadline": "",
                "jobDescription": "",
                "jdSnapshot": "",
                "jdCapturedAt": "",
                "jdKeywords": [],
                "jobFamily": "",
                "campusType": "",
                "salary": "",
                "experience": "",
                "matchScore": 0,
                "matchReasons": [],
                "gaps": [],
                "risks": [],
                "currentStatus": status,
                "statusUpdatedAt": applied_date or NOW[:10],
                "statusHistory": [
                    {
                        "status": status,
                        "date": applied_date or NOW[:10],
                        "sourceOfTruth": "migration",
                        "notes": record.get("nextAction", "")
                    }
                ],
                "englishInterviewPossible": False,
                "technicalInterviewPossible": False,
                "interviewPackId": "",
                "sourceOfTruth": "migration",
                "manualOverrides": {},
                "notes": record.get("nextAction", ""),
                "archived": True
            }
        )
    return migrated


def migrate_resumes(old_resume: dict) -> dict:
    sections = []
    for item in old_resume.get("sections", []):
        sections.append(
            {
                "sectionId": item.get("id", ""),
                "title": item.get("title", ""),
                "period": item.get("period", ""),
                "location": item.get("location", ""),
                "contentCN": item.get("chinese", ""),
                "contentEN": item.get("english", ""),
                "tags": infer_tags(item.get("title", "") + " " + item.get("chinese", "") + " " + item.get("english", "")),
                "suitableRoles": []
            }
        )
    return {
        "currentVersion": "2026-08-22-migration",
        "versions": [
            {
                "version": "2026-08-22-migration",
                "updatedAt": NOW,
                "profile": old_resume.get("profile", {}),
                "sections": sections,
                "sourceOfTruth": "migration"
            }
        ]
    }


def infer_tags(text: str) -> list[str]:
    tags = []
    mapping = {
        "C&B": ["c&b", "薪酬", "benefit", "insurance"],
        "HRBP": ["hrbp", "headcount"],
        "Talent Development": ["talent", "人才", "bei", "360"],
        "HR Digitalization": ["data", "dashboard", "clawbot", "数字化"],
        "Employee Experience": ["wellbeing", "employee experience", "员工活动"],
        "Vendor Management": ["vendor", "供应商", "eor"],
    }
    lower = text.lower()
    for tag, needles in mapping.items():
        if any(needle in lower for needle in needles):
            tags.append(tag)
    return tags


def initial_story_bank() -> dict:
    story_titles = [
        "家园 - 从成员到行政组长",
        "家园 - 组织制度建设",
        "字节 - 从关键词筛选到理解业务",
        "字节 - 与 HM 对齐岗位画像",
        "JD - Headcount Planning",
        "JD - 业务沟通",
        "Aon - BEI访谈",
        "Aon - 领导力模型",
        "Aon - AI评分辅助",
        "Midea - 海外员工数据治理",
        "Midea - EOR供应商",
        "Midea - UAT",
        "Binance - 多国保险续约",
        "Binance - 越南保险成本控制",
        "Binance - Wellbeing Portal",
        "Binance - Wellness Webinar",
        "Binance - Clawbot Skill",
    ]
    stories = []
    for title in story_titles:
        stories.append(
            {
                "storyId": f"story-{slug(title)}",
                "title": title,
                "facts": {
                    "company": title.split(" - ")[0],
                    "role": "",
                    "situation": "Needs User Input",
                    "task": "Needs User Input",
                    "actions": [],
                    "results": [],
                    "constraints": []
                },
                "competencies": [],
                "answerVersions": [],
                "reflection": "",
                "maturityScore": 0,
                "manualOverrides": {}
            }
        )
    return {
        "coreIntroduction": {
            "version": "v0",
            "updatedAt": NOW,
            "introCN60": "Needs User Input",
            "introCN120": "Needs User Input",
            "introEN60": "Needs User Input",
            "introEN120": "Needs User Input",
            "storyline": "学生组织中的组织管理兴趣 -> 理解业务为什么需要人 -> 人才标准与人才评价 -> 薪酬绩效、制度与国际 HR -> C&B、员工体验与 HR Digitalization -> 成为既理解业务又具备专业 HR 能力的人",
            "locked": True
        },
        "stories": stories,
        "questionTraining": {
            "pg8": [],
            "organizationObservation": []
        }
    }


def initial_companies() -> list[dict]:
    names = [
        ("字节跳动", "ByteDance", "互联网", "A", "High"),
        ("腾讯", "Tencent", "互联网", "A", "High"),
        ("阿里巴巴", "Alibaba", "互联网", "A", "High"),
        ("美团", "Meituan", "互联网", "A", "High"),
        ("京东", "JD.com", "互联网/零售科技", "A", "High"),
        ("华为", "Huawei", "科技/制造", "A", "High"),
        ("比亚迪", "BYD", "汽车/制造", "A", "High"),
        ("美的", "Midea", "制造", "A", "High"),
        ("宝洁", "P&G", "FMCG", "A", "High"),
        ("联合利华", "Unilever", "FMCG", "A", "High"),
    ]
    return [
        {
            "companyId": f"company-{slug(cn)}",
            "companyName": cn,
            "companyNameEn": en,
            "industry": industry,
            "tier": tier,
            "priority": priority,
            "careerSite": "",
            "campusSite": "",
            "bossKeyword": f"{cn} 人力资源",
            "linkedinKeyword": f"{en} HR campus",
            "notes": "",
            "active": True
        }
        for cn, en, industry, tier, priority in names
    ]


def main() -> None:
    old_jobs = read_json("data/jobs.json", [])
    old_applications = read_json("data/applications.json", {"records": []})
    old_resume = read_json("data/resume.json", {"profile": {}, "sections": []})

    archive = migrate_archive(old_jobs)
    applications = migrate_applications(old_applications)
    resumes = migrate_resumes(old_resume)

    write_json("data/archive.json", archive)
    write_json("data/applications.json", applications)
    write_json("data/opportunities.json", [])
    write_json("data/events.json", [])
    write_json("data/interviews.json", [])
    write_json("data/interview-packs.json", [])
    write_json("data/story-bank.json", initial_story_bank())
    write_json("data/resumes.json", resumes)
    write_json("data/companies.json", initial_companies())
    write_json("data/user-feedback.json", [])
    write_json(
        "data/pending.json",
        [
            {
                "pendingId": "pending-git-branch",
                "createdAt": NOW,
                "category": "workflow",
                "status": "open",
                "content": "Workspace .git directory is not a valid Git repository; cannot create feature/campus-job-os-v2 or commit until repaired.",
                "nextAction": "Move project into a valid GitHub repository or repair .git."
            }
        ],
    )

    handoff = {
        "runDate": NOW[:10],
        "processingWindow": {
            "start": "2026-08-21T12:00:00+08:00",
            "end": "2026-08-22T11:59:59+08:00"
        },
        "processedInputs": [],
        "newApplications": [],
        "statusChanges": [],
        "newEvents": [],
        "interviewPackUpdates": [],
        "storyBankUpdates": ["Initial Story Bank scaffold created with Needs User Input placeholders."],
        "feedbackProcessed": [],
        "feedbackPending": [],
        "searchIssues": [],
        "dataConflicts": [],
        "manualOverrides": [],
        "unresolvedItems": ["Git repository invalid; branch and commit blocked."],
        "nextRunMustRead": ["MASTER_REQUIREMENTS.md", "data/pending.json", "data/handoffs/2026-08-22_handoff.json"]
    }
    write_json("data/handoffs/2026-08-22_handoff.json", handoff)

    daily = {
        "runDate": NOW[:10],
        "mode": "migration",
        "activeMarket": "Mainland",
        "archivedHongKongRecords": len(archive["records"]),
        "migratedApplications": len(applications),
        "activeOpportunities": 0,
        "storyBankStories": len(initial_story_bank()["stories"]),
        "gitStatus": "blocked"
    }
    write_json("data/daily/2026-08-22.json", daily)

    report = f"""# 2026-08-22 Campus OS V2 Migration Report

## Summary

- Archived Hong Kong recommendation records: {len(archive["records"])}
- Duplicate archived records: {len(archive["duplicates"])}
- Migrated application records: {len(applications)}
- Active Mainland opportunities: 0
- Resume versions created: 1
- Story Bank scaffold stories: {len(initial_story_bank()["stories"])}

## Market Handling

Hong Kong records were preserved with `market = HongKong` and `archived = true`. They are excluded from active Mainland KPI and daily search.

## Unresolved

- Git branch creation blocked because this workspace is not a valid Git repository.
- Core Introduction content is marked `Needs User Input` and locked.
- Story facts are scaffolded and require user confirmation.

## Files Written

- data/archive.json
- data/applications.json
- data/opportunities.json
- data/events.json
- data/interviews.json
- data/interview-packs.json
- data/story-bank.json
- data/resumes.json
- data/companies.json
- data/user-feedback.json
- data/pending.json
- data/handoffs/2026-08-22_handoff.json
- data/daily/2026-08-22.json
"""
    (ROOT / "reports" / "2026-08-22_migration-report.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
