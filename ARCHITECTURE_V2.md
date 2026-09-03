# Campus Job Search OS V2 Architecture

## Product Scope

Campus Job Search OS V2 is a long-term PWA for Hayley's Mainland China 2027 campus recruitment HR job search.

Core workflow:

```text
Opportunity discovery
-> Application
-> Assessment / written test
-> Interview
-> Review
-> Offer
-> Analytics
-> Story Bank
```

The system is batch-oriented. AI-generated summaries, interview packs, recommendation reasons, and story suggestions are produced during the daily run and persisted to JSON. The runtime PWA reads JSON only; it does not require live AI.

## Deployment Target

```text
GitHub repository
-> Vercel
-> PWA
-> Mobile Add to Home Screen
```

The GitHub repository is the source of truth for application code and structured job-search data. Vercel deploys the production branch. V2 development happens on `feature/campus-job-os-v2`; do not merge into `main` before user acceptance.

Preview access uses Vercel's stable Git branch URL for `feature/campus-job-os-v2`. Commit-specific Preview URLs are immutable snapshots and are not the daily-use entry point. The service worker uses network-first requests for navigation, app-shell assets, and JSON, with cache only as an offline fallback. Vercel sends `no-store` for JSON and revalidation headers for HTML/app-shell assets and the service worker.

## Daily Run Contract

Daily run time:

```text
12:00 Asia/Shanghai
```

Processing window:

```text
yesterday 12:00:00 -> today 11:59:59
```

Daily runs must never depend on chat context as memory. Cross-run continuity must come from files in `data/`, `reports/`, `snapshots/`, `memory.md`, and `data/handoffs/`.

## Required Read Order

Every run begins by reading:

```text
MASTER_REQUIREMENTS.md
data/user-feedback.json
memory.md
data/applications.json
data/opportunities.json
data/jds.json
data/tests.json
data/events.json
data/interviews.json
data/story-bank.json
data/resumes.json
data/companies.json
data/reminders.json
data/pending.json
data/handoffs/latest handoff
data/inbox/*.json where processed = false
```

Search must not start before this checklist is complete.

## Data Model

Primary active data:

- `data/applications.json`: submitted or process-entered jobs.
- `data/opportunities.json`: unsubmitted opportunities only.
- `data/historical-opportunities.json`: closed/expired historical recommendations that are not application records; excluded from active pipeline/KPIs.
- `data/opportunity-history.json`: append-only daily recommendation snapshot index containing dates and canonical `jobId` references, including zero-result days.
- `data/target-company-watchlist.json`: durable per-company search status and evidence for core targets plus explicit user reminder companies.
- `data/jds.json`: JD Knowledge records linked by `jobId`.
- `data/tests.json`: independent assessment records; multiple records may link to one canonical `jobId`.
- `data/events.json`: deadlines, assessments, interviews, follow-ups.
- `data/interviews.json`: interview reviews.
- `data/interview-packs.json`: generated interview preparation packs.
- `data/story-bank.json`: stable stories, answer versions, question training.
- `data/resumes.json`: resume versions and copyable experience blocks.
- `data/companies.json`: target company list and priority rules.
- `data/reminders.json`: explicit user-added reminder list only.
- `data/pending.json`: unresolved data or workflow issues.
- `data/user-feedback.json`: user feedback ledger.
- `data/archive.json`: Hong Kong historical data and old recommendations.

Daily artifacts:

- `data/daily/YYYY-MM-DD.json`
- `reports/YYYY-MM-DD_daily-brief.md`
- `snapshots/YYYY-MM-DD_campus-dashboard.html`
- `data/handoffs/YYYY-MM-DD_handoff.json`

The home page reads data freshness from `data/daily/latest.json` and deployed code identity from `/api/version`; these values are intentionally independent. Historical opportunity views resolve snapshot `jobId` references across canonical opportunities, historical opportunities, applications, and archive data so status changes do not erase prior recommendations. Only `APPLY_NOW` and `OPEN` opportunity records enter the active pipeline todo surface.

## Markets

Active market:

```text
Mainland
```

Hong Kong historical data:

```text
market = HongKong
archived = true
```

Hong Kong records remain searchable in Records/Archive but are excluded from active dashboard KPI and daily search unless explicitly reopened by the user.

## Reminder List Policy

Pipeline reminder rows are explicit-only. The system must not create reminders from target companies, historical recommendations, archive records, or inferred company interest. A row enters `data/reminders.json` only when the user directly asks to add it or provides a current reminder list in text/image form.

## UI Architecture

The PWA has six first-level navigation items:

```text
首页
机会
流程
测试
面试
我的
```

Pages:

- Dashboard
- Opportunities
- Pipeline
- Assessment Tracker
- Interview Workspace
- My Settings / Records

Story Bank and Resume Copy Tool are modules inside the 面试 tab, not first-level navigation items.

Pipeline has internal filters, including `JD`. JD Knowledge is a Pipeline sub-tab, not a primary navigation item.

Pipeline records use the canonical application object end to end. The browser overlays repository applications with device-local drafts from `campus-os-pipeline-drafts-v1`, keyed by `jobId`; an existing record edit retains its full canonical fields and appends status history. A new local record receives an `app-local-*` identity but uses the same fields and must be reconciled during repository import.

The Pipeline Excel boundary is one round-trip workbook with exactly two ordered sheets: `流程` first and `测评` second. It includes stable IDs and JSON-serialized structured fields so offline edits can be validated and merged without flattening histories or raw assessment evidence. Import is explicit and validation-based; it is not browser-to-repository synchronization.

Desktop/tablet use a fixed left sidebar. Mobile uses a hamburger-triggered left drawer to preserve vertical space for tables, timelines, interview notes, resume copy, and Story Bank content.

Mobile-first rules:

- 44px+ tap targets.
- Pipeline uses responsive grid/card rows without whole-page horizontal scroll.
- Drawers become full-screen panels.
- One-tap copy for resume and story content.

Assessment records merge repository JSON with device-local drafts at render time. Local drafts use the versioned `campus-os-assessment-drafts-v1` localStorage key and remain explicitly device-local. `assessmentScope` defaults to 海测, `testType` is a multi-select array, and only yearless `MM-DD` due/completed dates are stored; `receivedAt`, calendar year, and clock time are not part of the assessment record. Legacy local drafts with a string test type or full ISO date are normalized in memory without expanding the repository schema.

Assessment evidence and analysis are separate layers. `sourceMaterials` is append-only raw evidence with stable IDs and file/URL/text provenance. `assessmentSummary` is a derived synthesis whose material ID coverage determines `analysisStatus` (`NEEDS_SOURCE`, `NOT_ANALYZED`, `STALE`, or `CURRENT`). The table consumes only 3–6 concise summary bullets; details expose the full categorized synthesis and raw sources separately. A new material changes the status to stale/not-analyzed and requires re-analysis of the complete retained source set.

The browser exports the merged records as an `.xlsx` workbook with `Tests` and `Source Materials` sheets using the vendored SheetJS runtime, which is cached with the offline shell. Daily Run may validate and import a returned workbook into `data/tests.json`; it must not replace existing records or alter application status.

## Search Pipeline

Search results and recommendations are separated:

```text
Raw Search Results
-> Candidate Pool
-> Validation Pool
-> Eligible Jobs
-> Recommended Jobs
```

Only jobs satisfying all gates can be recommended:

- URL and job identity verified.
- Job is active/open.
- Posting freshness valid.
- Not duplicate.
- Experience fits early-career.
- Company quality acceptable.
- Salary acceptable or clearly marked as unknown risk where allowed.
- Job direction matches HR target.
- Not archived or already applied.

## JD Knowledge Data Flow

JD capture uses the same canonical `jobId` as applications, opportunities, reminders, historical records, and interview packs.

```text
user/platform JD
-> persist raw JD
-> match jobId
-> compute jdHash
-> detect duplicate/change
-> extract JD structure
-> update JD Knowledge
-> mark interview pack refresh only if jdHash changed
```

`data/jds.json` stores raw JD, snapshot, summary, distinctive keywords, unique requirements, must-have, nice-to-have, interview signals, key original excerpts, version history, and refresh flags. Missing JD is represented explicitly with `jdStatus = JD Missing` and empty generated fields.

`jdKeyOriginalExcerpt` must be a verbatim substring of `jdRaw` or `jdSnapshot`.

## Status Semantics

Closed is not Rejected.

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

All analytics must be derived from real `statusHistory`, not inferred from labels alone.

`Application In Progress` means the user started an application flow but has not confirmed final submission. It is not Applied and must not count toward Applied KPI. It preserves `applicationStartedAt`, keeps `appliedDate` empty until final submission, keeps `applyUrl`, remains unarchived, and appears as a high-priority pending action with a `继续投递` link.

## Story Bank

Story Bank is a long-term interview asset inside the 面试 tab. It is organized by competency and question type rather than by company.

Story facts and answer versions are separated:

- Facts are stable and must not drift unless the user corrects them.
- Answer versions may be improved over time.

Core Introduction is stable and locked by default. Daily runs must not rewrite it without explicit user approval.

## Interview Draft and Application Summary Flow

The Interview Records panel overlays repository records from `data/interviews.json` with device-local drafts from `localStorage` key `campus-os-interview-drafts-v1`. Both use the same interview fields and merge by `interviewId`; the browser never claims that a local draft is synchronized. Excel export produces a dated workbook with an `Interviews` sheet for later validated import.

Complete user-reported applications are processed by the reusable `apply-summary` skill around the existing pipeline:

```text
raw user application message
-> durable inbox evidence
-> canonical identity/dedup check
-> existing application + JD stores
-> Feishu Base upsert
-> generated jobs.json/dashboard
```

Raw JD, derived JD analysis, exact source URL, link-verification state, and application status remain separate facts. An application-history URL is not promoted to an exact JD URL without verification.

## Regression Protection

Regression tests must verify:

- No duplicate `jobId` or `sourceJobId`.
- No bad URL or URL-job mismatch.
- Applied jobs do not appear in Opportunities.
- Application In Progress jobs do not count as Applied and remain in pending actions.
- Archived Hong Kong records do not affect active KPI.
- Reminder/watch rows are not auto-generated from `companies` or `archive`.
- JD Knowledge preserves raw JD and validates excerpts as original substrings.
- JD Missing records do not generate summaries or interview signals.
- Closed is not counted as Rejected.
- Required `statusHistory` exists.
- Dates are valid.
- Upcoming events are chronological and not stale.
- Manual overrides are preserved.
- Core Introduction is stable.
- Story facts do not drift.
- Processed inbox files are not reprocessed.
- Handoff exists after a completed run.

## Current Repository State

Development is connected to `hayley08/job-hunting-buddy` on `feature/campus-job-os-v2`. `main` is the Vercel production branch and must remain untouched until V2 is accepted.

## Feishu Base Sync Boundary

Feishu integration is an adapter around the existing canonical model, not a new model:

```text
existing search adapters
-> existing normalization and deduplication
-> Feishu Base upsert
-> scheduled Feishu Base pull
-> data/jobs.json generated mirror
-> existing applications/opportunities/JD/history stores
-> current static dashboard
```

Field mapping must be resolved from the actual Base table and the repository schema. Unknown Base columns are ignored; missing repository fields remain empty rather than causing schema expansion. The exact original job URL and raw JD retain their current integrity rules. A scheduled, non-Codex runtime performs the 18:00 Asia/Shanghai pull and commits only generated data changes to `feature/campus-job-os-v2`. Runtime credentials remain outside Git.
