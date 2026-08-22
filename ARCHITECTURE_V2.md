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
- `data/jds.json`: JD Knowledge records linked by `jobId`.
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

The PWA has five first-level navigation items:

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

Story Bank and Resume Copy Tool are modules inside the 面试 tab, not first-level navigation items.

Pipeline has internal filters, including `JD`. JD Knowledge is a Pipeline sub-tab, not a primary navigation item.

Desktop/tablet use a fixed left sidebar. Mobile uses a hamburger-triggered left drawer to preserve vertical space for tables, timelines, interview notes, resume copy, and Story Bank content.

Mobile-first rules:

- 44px+ tap targets.
- Pipeline keeps a compact table with horizontal scroll and sticky company column where needed.
- Drawers become full-screen panels.
- One-tap copy for resume and story content.

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

## Story Bank

Story Bank is a long-term interview asset inside the 面试 tab. It is organized by competency and question type rather than by company.

Story facts and answer versions are separated:

- Facts are stable and must not drift unless the user corrects them.
- Answer versions may be improved over time.

Core Introduction is stable and locked by default. Daily runs must not rewrite it without explicit user approval.

## Regression Protection

Regression tests must verify:

- No duplicate `jobId` or `sourceJobId`.
- No bad URL or URL-job mismatch.
- Applied jobs do not appear in Opportunities.
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
