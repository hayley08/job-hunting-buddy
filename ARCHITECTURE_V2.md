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

The GitHub repository is the source of truth for application code and structured job-search data. Vercel deploys the production branch. This workspace currently is not a valid Git repository, so branch creation and commits are blocked until the project is moved into or repaired as a real Git repo.

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
data/events.json
data/interviews.json
data/story-bank.json
data/resumes.json
data/companies.json
data/pending.json
data/handoffs/latest handoff
data/inbox/*.json where processed = false
```

Search must not start before this checklist is complete.

## Data Model

Primary active data:

- `data/applications.json`: submitted or process-entered jobs.
- `data/opportunities.json`: unsubmitted opportunities only.
- `data/events.json`: deadlines, assessments, interviews, follow-ups.
- `data/interviews.json`: interview reviews.
- `data/interview-packs.json`: generated interview preparation packs.
- `data/story-bank.json`: stable stories, answer versions, question training.
- `data/resumes.json`: resume versions and copyable experience blocks.
- `data/companies.json`: target company list and priority rules.
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

## UI Architecture

The PWA has a fixed mobile bottom navigation:

```text
首页
机会
流程
面试
Story
我的
```

Pages:

- Dashboard
- Opportunities
- Pipeline
- Interview Center
- Story Bank
- My Resume / Records

Mobile-first rules:

- 44px+ tap targets.
- Tables collapse into cards.
- Drawers become full-screen panels.
- One-tap copy for resume and story content.
- No mandatory horizontal scroll on mobile.

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

Story Bank is a long-term interview asset and has its own tab. It is organized by competency and question type rather than by company.

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
- Closed is not counted as Rejected.
- Required `statusHistory` exists.
- Dates are valid.
- Upcoming events are chronological and not stale.
- Manual overrides are preserved.
- Core Introduction is stable.
- Story facts do not drift.
- Processed inbox files are not reprocessed.
- Handoff exists after a completed run.

## Current Known Constraint

This workspace is not a valid Git repository despite containing a `.git` directory. The requested branch `feature/campus-job-os-v2` and Git commit cannot be created until the repository is repaired or moved into a valid Git checkout.
