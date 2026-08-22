# Campus Job Search OS V2 Daily Run

This repository is the persistent source of truth for Hayley's Mainland China 2027 campus recruitment job search.

## Required Start Sequence

Every daily run must read these files before searching or editing data:

1. `MASTER_REQUIREMENTS.md`
2. `data/user-feedback.json`
3. `memory.md`
4. latest `data/handoffs/*_handoff.json`
5. `data/pending.json`
6. `data/applications.json`
7. `data/opportunities.json`
8. `data/events.json`
9. `data/interviews.json`
10. `data/story-bank.json`
11. `data/resumes.json`
12. `data/companies.json`
13. every `data/inbox/*.json` where `processed = false`

Do not depend on Codex chat history as memory.

## Daily Window

Run at 12:00 Asia/Shanghai.

Process the fixed window:

`yesterday 12:00:00 -> today 11:59:59`

## Active Scope

Active market is Mainland China 2027 campus recruitment for HR roles.

Hong Kong data is archive-only:

- `market = HongKong`
- `archived = true`
- excluded from active KPI
- excluded from daily search unless the user explicitly reopens Hong Kong

## Daily Flow

1. Load requirements, memory, handoff, pending, and inbox.
2. Normalize raw user input.
3. Merge new facts without overwriting history.
4. Preserve manual overrides.
5. Update applications, events, interviews, and Story Bank.
6. Search new Mainland campus HR opportunities.
7. Validate links, freshness, status, job identity, and relevance.
8. Write JSON data.
9. Update the PWA dashboard data.
10. Generate `data/daily/YYYY-MM-DD.json`.
11. Generate `reports/YYYY-MM-DD_daily-brief.md`.
12. Generate `snapshots/YYYY-MM-DD_campus-dashboard.html`.
13. Append `memory.md`.
14. Write `data/handoffs/YYYY-MM-DD_handoff.json`.
15. Run regression tests.
16. Commit when the Git repository is valid.

## Quality Rules

Accuracy beats volume. It is acceptable to recommend 0 opportunities.

Never show a job as ready to apply when the URL, company, title, or active status is unverified.

Closed is not Rejected.

Applied jobs must not appear in Opportunities.

Core Introduction is locked by default and cannot be rewritten by an automated daily run.

Story facts are stable facts. Interview review may add answer versions or reflections, but must not rewrite facts unless the user explicitly corrects them.
