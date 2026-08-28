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

## Cross-Thread Persistence Rule

Chat history is not the source of truth.

Before ending a working session, and immediately after any material user decision or change:

- Persist new requirements and manual overrides to the appropriate repository documentation or structured ledger.
- Persist raw job and application information to the appropriate JSON/data files.
- Update `memory.md` only when durable cross-thread context is needed; do not use it as a transient activity log.
- Commit meaningful completed changes.

A future Codex thread must be able to reconstruct the current project state from the repository without access to previous conversation history. Never leave a material user requirement only inside chat history.

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
data/historical-opportunities.json
data/opportunity-history.json
data/target-company-watchlist.json
data/jds.json
data/events.json
data/interviews.json
data/story-bank.json
data/resumes.json
data/companies.json
data/reminders.json
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

The stable Preview access point for V2 is the Vercel branch URL for `feature/campus-job-os-v2`, not a commit-specific Preview URL. HTML, JavaScript, CSS, the manifest, and JSON must use online-first freshness with cached offline fallback. JSON requests must bypass HTTP and browser caches while online. Offline support must never make stale campus-recruitment data the normal online experience.

## Version Visibility

The top of the home page must show lightweight, independently sourced freshness information:

```text
Last updated: YYYY-MM-DD HH:mm UTC+8
Web version: <commit short SHA>
```

`Last updated` is the structured job-search data update time and must come from daily/data metadata. `Web version` is the deployed code commit and must come from the deployment environment. Never substitute the data date for the code version or imply that a newer deployment necessarily contains newer job data.

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

Desktop Pipeline and JD grids must render as visually continuous tables: every cell in a row stretches to the full row height, column boundaries remain consistent with the header, and each horizontal separator forms one aligned line across the complete row. Variable-length notes must never create staggered per-cell underlines. Tablet/mobile may switch to the established card layout without horizontal page scrolling.

## Dashboard KPI

Default home page shows 投递中, 已投递, 筛选中, 测评/笔试, 面试, Offer, 最近7天投递, and 最近7天进入面试. Conversion analytics must come from real `statusHistory`.

All `Application In Progress` records must also appear in 首页 / 需要行动 as high-priority pending actions with a `继续投递` link when `applyUrl` exists.

## Upcoming

Home page must show Today, Tomorrow, and Next 7 Days for deadlines, assessments, written tests, interviews, and follow-ups.

## Applications

`applications.json` contains all process-entered jobs: submitted jobs, applications in progress, historical applications, and user-provided application facts. Do not overwrite history.

Application date fields:

```text
applicationStartedAt = user started the application flow
appliedDate = confirmed final submission date only
```

If the user starts but does not complete an application, set `currentStatus = Application In Progress`, keep `appliedDate` empty, preserve `applyUrl`, and add a status history event. Do not count it as Applied.

## Reminder List

`data/reminders.json` contains only companies or roles the user explicitly asks to add to the reminder list, including lists supplied by image or text. The system must not auto-generate reminder, watchlist, or historical-reference rows from `data/companies.json`, `data/archive.json`, old recommendations, or keyword matches.

Reminder list rule:

```text
explicit user add/list only
```

If the user says "请添加 xxx 进提醒列表" or provides a current reminder list, add it. Otherwise, keep target companies and archive records as reference data only.

## Opportunities

`opportunities.json` contains current canonical unsubmitted opportunities. Applied jobs may move to `applications.json`, but their historical recommendation membership must remain in `data/opportunity-history.json` and continue resolving to the canonical job by `jobId`.

Closed/expired historical recommendation records that are not applications are stored in `data/historical-opportunities.json`; they remain resolvable from historical snapshots but must not enter active pipeline/KPI counts. Current company-level `WATCH`, `UPCOMING`, and `VERIFY` leads may remain in `opportunities.json`, while only `APPLY_NOW` and `OPEN` enter the pipeline todo surface.

The 机会 tab is an append-only recommendation history, not a replace-on-each-run list. It must provide date filters:

```text
全部
MM/DD
MM/DD
...
```

Each Daily Run appends one snapshot for that run date, including a valid zero-result snapshot, and must never delete or overwrite earlier snapshot dates. Snapshot membership is stored as `jobId` references; canonical job objects must not be duplicated.

Every recommended job preserves:

```text
firstRecommendedAt
recommendationDate
recommendationDates
currentStatus
```

`firstRecommendedAt` never changes. `recommendationDate` records the first recommendation date for compatibility, while `recommendationDates` contains every date on which the job was recommended. If an opportunity later becomes Applied, Closed, expired, Rejected, Withdrawn, or Archived, it must remain visible under its historical recommendation dates while showing its latest canonical status. Status changes update the canonical record; they do not remove historical snapshot membership.

Source priority:

```text
company/campus official site
BOSS
LinkedIn
Public Web
JobsDB
```

Applied jobs must be removed from the current unsubmitted canonical opportunity collection, but never from historical opportunity snapshots.

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

## JD Knowledge

JD Knowledge is a sub-tab inside 流程. It must not become a first-level navigation item.

The 流程 filters must include:

```text
全部
投递中
已投递
流程中
面试
Offer
待投递
提醒列表
已结束
JD
```

JD data is stored in `data/jds.json` and linked to applications, opportunities, reminders, interview packs, and historical records by `jobId`. Do not duplicate canonical job objects.

Every JD record must preserve raw source text when available:

```json
{
  "jobId": "",
  "jdRaw": "",
  "jdSnapshot": "",
  "jdCapturedAt": "",
  "jdSource": "",
  "jdUrl": "",
  "jdHash": "",
  "jdSummary": "",
  "jdCoreResponsibilities": [],
  "jdDistinctiveKeywords": [],
  "jdUniqueRequirements": [],
  "jdInterviewSignals": [],
  "jdMustHave": [],
  "jdNiceToHave": [],
  "jdKeyOriginalExcerpt": [],
  "jdVersions": []
}
```

Raw JD rule:

```text
original JD text must be saved before summary
```

If only company/title/link exists, mark `jdStatus = JD Missing`. Do not generate summary, interview signals, or original excerpts from missing JD.

`jdSummary` should extract what makes the role different from a generic HR role. `jdDistinctiveKeywords` prioritizes special HR modules, business context, employee population, systems, legal/regulatory scope, language requirements, geography, methodology, transformation, and digitalization.

`jdKeyOriginalExcerpt` must be copied verbatim from `jdRaw` or `jdSnapshot`. Keep only the most distinctive 3-6 bullets or sentences, and never rewrite them for style.

Long JD handling: store the full JD in JSON, but show summary, distinctive keywords, unique requirements, and original excerpts first. Full JD is collapsed by default.

JD updates use `jdHash` plus `jdVersions`. Repeated identical JD must not duplicate. Changed JD creates a new version and marks `interviewPackNeedsRefresh = true`. Interview Packs refresh only when `jdHash` changes, not on every daily run.

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

Recruiting content is not an automatic exclusion when the same role also has material HRBP, OD, TD, C&B, HR Operations, employee experience, or other broad HR responsibilities. Classify based on the actual work mix.

## Search Run Types

Normal runs use `DAILY_RUN` and the fixed yesterday 12:00 through today 11:59 UTC+8 window. A user-authorized initialization run may use `SEED_TEST_RUN` outside that window. A seed run must be explicitly marked and must create a baseline daily artifact, QA report, and seed handoff for the next normal run.

Searches must be real source searches, not mock data or schema-only runs. Search quality is more important than result count; zero or a few strong recommendations are valid.

## Opportunity Classification and Scoring

Every searched result must use exactly one classification:

```text
APPLY_NOW
OPEN
WATCH
UPCOMING
HISTORICAL
VERIFY
```

The UI labels are 建议立即投递, 当前可投, 持续关注, 即将开放, 往届参考, 待核实. These classifications are not application statuses.

Match Score remains a 10-point score:

```text
Candidate Fit: 4
Entry Barrier: 2
Company / Growth: 2
Freshness / Validity: 2
```

Recommendation reasons must explicitly connect JD evidence to named resume experience. Generic fit statements are prohibited. Every record must also state material risks, such as recruiting-heavy scope, non-priority location, high experience threshold, internship-only status, administrative scope, uncertain language requirement, missing JD, or unverified link.

Roles explicitly requiring 4+ years without graduate/early-career signals cannot be high priority. They may be Low Priority / Reference or excluded. Pure recruitment/TA, headhunting, cold-call-heavy, sales, front desk, pure administration, insurance agent, and nominal-HR sales roles are excluded.

## Target Company Watchlist Search

Daily and seed searches must separately check the active target companies and user reminder companies using multiple campus and HR-module keyword combinations, not only `HR`. Target company search statuses are:

```text
OPEN
CAMPUS_OPEN_HR_UNKNOWN
UPCOMING
NOT_FOUND_YET
HISTORICAL_REFERENCE
CLOSED
```

Target companies remain in the watchlist even when no current 2027 HR opening is found. When a target company changes from WATCH / no-current-opening to OPEN, record it under 今日新开.

The complete current watchlist state is persisted in `data/target-company-watchlist.json`, including the check timestamp, status, evidence URL when available, and a concise note. It is never reconstructed from chat history.

## Search Sources and Lead Handling

Search source priority:

```text
P0 official company careers / campus / graduate pages
P1 BOSS / LinkedIn
P2 牛客 / university career sites / reliable campus aggregators
P3 public-web / community leads
```

P3 results remain leads until verified against P0-P2 when possible. Historical references must state their year. Full JD content must be saved before summarization; title-only findings are `JD Missing` and must not be completed by inference.

## Search QA and Feedback Loop

Every completed search run records candidate counts, screening counts, classifications, exclusions, duplicates, broken/unverified links, experience rejections, pure-recruitment rejections, expiry rejections, source/adapter failures, low-confidence results, and top recommendations. The next run must read the prior QA and handoff before searching.

Search feedback is persisted in `data/user-feedback.json` as `positive_search_feedback`, `negative_search_feedback`, or `search_preference` and must affect subsequent ranking/searches.

The system may search, recommend, save, analyze, and provide links. It must never automatically submit an application.

## Mainland Priority

Priority cities: 北京, 上海, 深圳, 广州, 杭州.

Extended cities: 南京, 苏州, 成都, 武汉.

Priority company types: 互联网大厂, 知名外企, 大型汽车, 大型制造, 半导体, FMCG, 金融, 科技, 500强, 行业头部.

## URL Integrity

For every opportunity, validate `jobId`, `sourceJobId`, company, title, and URL. If inconsistent, mark `Link Unverified` and do not show one-click apply.

### Single Job URL Import

When the user provides one job-detail URL, the system may run the single-URL importer. It must:

- fetch the real page or its official structured job-detail endpoint;
- map the result through the existing `Job` model, normalization, deduplication, opportunity storage, JD storage, and opportunity-history flow;
- preserve the exact user-provided URL in the existing URL fields;
- save the complete original JD before any extractive or AI summary;
- use only fields already present in the canonical opportunity and JD schemas;
- return a specific failure reason and write no invented job when title, company, URL identity, or JD cannot be verified;
- remain independent of the LinkedIn, JobsDB, and BOSS daily adapters unless explicitly invoked for one URL.

Deduplication remains `sourceJobId -> canonical URL -> company + normalized title + location`; a repeated identical URL import updates the existing canonical record/JD rather than creating another job.

When the user explicitly reports the imported URL as submitted, the canonical job must move from Opportunities into the existing Applications funnel with `currentStatus = Applied`, the user-reported `appliedDate`, and an append-only status-history event. Its historical opportunity snapshot and full JD must remain available.

## Status

Standard statuses:

```text
Saved
Recommended
Application In Progress
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

Status semantics:

```text
待投递 = not started
投递中 / Application In Progress = application flow started but final submission not confirmed
已投递 / Applied = final submission confirmed
```

`Application In Progress` is a high-priority pending action. It must:

- stay unarchived unless the user explicitly closes or withdraws it;
- preserve `applicationStartedAt` separately from `appliedDate`;
- preserve the `Application In Progress` event in `statusHistory` after later moving to `Applied`;
- show a red/high-warning badge and `⚠ 尚未完成投递`;
- in 流程, use the red bold job title itself as the apply/continue hyperlink when `applyUrl` exists; do not render a separate `继续投递` button that can disrupt row alignment;
- in 首页 / 需要行动, a compact `继续投递` action may remain when `applyUrl` exists;
- remain in Daily Run reminders until the user confirms submission.

When the user says "xxx 投了一半，链接是 yyy", parse it as `Application In Progress`, not `Applied`. Only user language such as "已经投完了" / "提交成功" moves it to `Applied`.

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

The public repository and deployed website must keep personal email and phone fields redacted unless the user explicitly authorizes publication. The private source resume remains authoritative for those fields; redaction must not alter the rest of the resume content.

## Archive / Records

Archive includes Hong Kong old applications, Rejected, Closed, Withdrawn, Completed Process, and Old Recommendations. Archived records do not affect active KPI.

## Daily Report

Generate `reports/YYYY-MM-DD_daily-brief.md` with processing window, pipeline, status changes, unfinished applications, upcoming, recommendations, interview prep, Story Bank updates, feedback processed, pending issues, conflicts, search/data failures, and Git/deploy status. Zero is a valid result.

## End-of-Run Checklist

A run is complete only if raw inputs, corrections, feedback, overrides, unfinished applications, pending queue, status history, events, JD snapshots, interview pack versions, handoff, memory, daily report, JSON validation, and Git/deploy status are handled or explicitly marked blocked.

## Regression Tests

Regression tests must check duplicate IDs, bad URL, URL-job mismatch, Applied job in Opportunities, Application In Progress not counted as Applied KPI, Application In Progress pending actions, continue-apply links, `applicationStartedAt` separated from `appliedDate`, Application In Progress history preservation after Applied, unfinished applications not auto-archived, deadline-priority reminders, Archived HK in Active, Closed counted as Rejected, missing statusHistory, invalid dates, past Upcoming events, manual override overwritten, auto-generated reminder/watch rows, JD Missing behavior, raw JD preservation, original excerpt substring validation, stable jdHash, JD versioning, Interview Pack refresh only on JD change, core introduction changed unexpectedly, story facts drifted, processed inbox reprocessed, and missing handoff.

Regression tests must also verify independent data/code version display, immutable opportunity snapshot dates, canonical `jobId` references, recommendation metadata preservation, zero-result daily snapshots, and continued historical visibility after an opportunity changes to Applied, Closed, expired, Rejected, Withdrawn, or Archived.

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
