# Campus Job Search OS V2 - Master Requirements

This file is the single source of truth for stable, long-term rules. Daily runs must read it before doing any search, processing, generation, or dashboard update.

## System Goal

Build a long-term Campus Recruitment Job Search OS for Hayley's Mainland China 2027 campus recruitment HR job search.

Core workflow:

```text
岗位发现
-> 投递
-> 测评/笔试
-> 面试
-> 复盘
-> Offer
-> 数据分析
-> Story Bank 沉淀
```

Current architecture:

```text
PWA + GitHub + Vercel + JSON
```

No real-time AI is required in the PWA. AI-generated recommendations, summaries, story suggestions, and interview packs are produced during the daily batch run and written to JSON.

## Active Market

Active market:

```text
Mainland
```

Hong Kong historical data:

```text
market = HongKong
archived = true
```

Hong Kong data must be preserved but excluded from active dashboard KPI and daily search unless the user explicitly reopens Hong Kong search.

## Daily Run

Daily run time:

```text
12:00 Asia/Shanghai
```

Processing window:

```text
yesterday 12:00:00 -> today 11:59:59
```

Daily runs may happen in independent Codex runs, but they must not rely on chat context. Cross-run memory must be persisted to files.

## Mandatory Read Checklist

Every run must read, in order:

```text
MASTER_REQUIREMENTS.md
data/user-feedback.json
memory.md
data/applications.json
data/opportunities.json
data/events.json
data/interviews.json
data/story-bank.json
data/resumes.json
data/companies.json
data/pending.json
latest data/handoffs/*.json
data/inbox/*.json where processed = false
```

The run must confirm requirements, latest handoff, pending feedback count, pending inbox count, pending issues count, last successful run, and current processing window before searching.

## User Feedback Ledger

All user corrections, feature requests, search-quality feedback, UI suggestions, story changes, resume changes, and workflow issues must be persisted in `data/user-feedback.json`.

Categories:

```text
search-quality
company-priority
job-classification
resume
interview
story-bank
ux
data
automation
bug
workflow
```

Statuses:

```text
new
accepted
implemented
rejected
needs-clarification
```

Stable long-term strategy changes also update this file.

## Raw Inbox

Raw user input must be saved in `data/inbox/YYYY-MM-DD_user-input.json` before processing. Processed inputs are marked, not deleted.

## Handoff

Every complete daily run writes:

```text
data/handoffs/YYYY-MM-DD_handoff.json
```

The next run must read the latest handoff.

## Pending Queue

Unresolved issues go to `data/pending.json`, including JD verification, missing dates, BOSS blocked, unclear resume version, application status uncertainty, and story facts needing user input.

## Conflict Resolution

Conflict priority:

```text
explicit latest user correction
>
manual override
>
verified official source
>
existing structured data
>
platform source
>
model inference
```

Conflicts must be recorded, never silently overwritten.

## Manual Overrides

Manual user corrections can lock fields. Automated classification must not overwrite locked values.

Principle:

```text
manual explicit correction > automated judgment
```

## Data Source of Truth

Important fields should preserve `sourceOfTruth`:

```text
user
official-site
email
boss
linkedin
jobsdb
public-web
inferred
```

System-discovered jobs must never automatically become `Applied`.

## Deployment

Target:

```text
GitHub -> Vercel -> PWA
```

Main product has one stable URL. Daily artifacts are:

```text
snapshots/YYYY-MM-DD_campus-dashboard.html
reports/YYYY-MM-DD_daily-brief.md
data/daily/YYYY-MM-DD.json
```

Do not create `final.html`, `latest2.html`, or similar throwaway dashboard names.

## PWA Requirements

Implement `manifest.json`, `service-worker.js`, Add to Home Screen, standalone display, mobile app-like layout, offline shell, and network-first JSON loading. The service worker must not cause phones to keep stale JSON after GitHub/Vercel updates.

## Main Navigation

Primary navigation is fixed to five first-level tabs:

```text
首页
机会
流程
面试
我的
```

Pages:

- Dashboard
- Opportunities
- Pipeline
- Interview Workspace
- My Settings / Records

Story Bank and Resume Copy Tool are modules inside the 面试 tab. They must not appear as first-level navigation items.

Desktop and tablet use a fixed left sidebar. Mobile uses a collapsed left rail / hamburger drawer. Do not restore the six-item bottom navigation.

## Dashboard KPI

Default home page shows 已投递, 筛选中, 测评/笔试, 面试, Offer, 最近7天投递, and 最近7天进入面试. Conversion analytics must come from real `statusHistory`.

## Upcoming

Home page must show Today, Tomorrow, and Next 7 Days for deadlines, assessments, written tests, interviews, and follow-ups.

## Applications

`applications.json` contains all clearly submitted jobs. It is the union of current applications, historical applications, and user-provided application facts. Do not overwrite history.

## Opportunities

`opportunities.json` contains unsubmitted opportunities only.

Source priority:

```text
company/campus official site
BOSS
LinkedIn
Public Web
JobsDB
```

Applied jobs must be removed from Opportunities.

## Job Identity

Stable ID:

```text
jobId
```

Dedupe priority:

```text
sourceJobId
canonicalUrl
company + normalizedTitle + location
```

Array index must never be used as an ID.

## Target Directions

Priority:

```text
HRBP
HR Generalist
HR Operations
People Operations
COE
C&B
Compensation & Benefits
Talent Development
人才发展
OD
Organization Development
L&D
Learning & Development
Employee Experience
Employee Engagement
HR Digitalization
HR Transformation
HR Analytics
HR Management Trainee
人力资源管培
```

Exclude:

```text
纯招聘
纯TA
猎头
招聘销售
行政
前台
销售
招商
保险代理
Cold Call-heavy
```

## Mainland Priority

Priority cities: 北京, 上海, 深圳, 广州, 杭州.

Extended cities: 南京, 苏州, 成都, 武汉.

Priority company types: 互联网大厂, 知名外企, 大型汽车, 大型制造, 半导体, FMCG, 金融, 科技, 500强, 行业头部.

## URL Integrity

For every opportunity, validate `jobId`, `sourceJobId`, company, title, and URL. If inconsistent, mark `Link Unverified` and do not show one-click apply.

## Status

Standard statuses:

```text
Saved
Recommended
Applied
Resume Screening
Online Assessment
Written Test
HR Interview
Business Interview
Case Interview
Final Interview
Offer
Rejected
Withdrawn
Closed
Archived
```

Closed is not Rejected.

## Story Bank

Story Bank is a long-term interview asset inside the 面试 tab. It is organized by competency and question type, not simply by company.

Core Introduction is stable and locked by default. Daily runs must not rewrite it unless the user explicitly approves.

Story facts and answer versions are separate. Facts must not drift for better writing.

Initial Story Bank must include JiaYuan, ByteDance, JD, Aon, Midea, and Binance stories from the V2 specification. Incomplete facts are marked `Needs User Input`.

## Interview Center

The 面试 tab contains Interview Records, Resume Copy Tool, and Story Bank.

Interview Packs are generated only when there is a new application, JD change, resume change, story change, interview-stage change, or explicit user request. If nothing changed, reuse the old version.

## Resume Versions

Resume Copy Tool must be available inside the 面试 tab. Resume content preserves 复制中文, Copy English, per-section copying, bullet-level copying when possible, and 查看全文. Each update creates a new version. Do not overwrite historical metadata.

## Archive / Records

Archive includes Hong Kong old applications, Rejected, Closed, Withdrawn, Completed Process, and Old Recommendations. Archived records do not affect active KPI.

## Daily Report

Generate `reports/YYYY-MM-DD_daily-brief.md` with processing window, pipeline, status changes, upcoming, recommendations, interview prep, Story Bank updates, feedback processed, pending issues, conflicts, search/data failures, and Git/deploy status. Zero is a valid result.

## End-of-Run Checklist

A run is complete only if raw inputs, corrections, feedback, overrides, pending queue, status history, events, JD snapshots, interview pack versions, handoff, memory, daily report, JSON validation, and Git/deploy status are handled or explicitly marked blocked.

## Regression Tests

Regression tests must check duplicate IDs, bad URL, URL-job mismatch, Applied job in Opportunities, Archived HK in Active, Closed counted as Rejected, missing statusHistory, invalid dates, past Upcoming events, manual override overwritten, core introduction changed unexpectedly, story facts drifted, processed inbox reprocessed, and missing handoff.

## Execution Order

Required order:

1. Audit current repository
2. Output `ARCHITECTURE_V2.md`
3. Update `MASTER_REQUIREMENTS.md`
4. Migration and migration report
5. Build JSON data layer
6. Daily run memory / inbox / handoff / override
7. PWA Dashboard
8. Story Bank
9. Interview Center
10. Regression tests
11. Vercel-ready configuration

Stop after these steps and wait for user acceptance.
