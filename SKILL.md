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
8. `data/opportunity-history.json`
9. `data/historical-opportunities.json`
10. `data/target-company-watchlist.json`
11. `data/tests.json`
12. `data/events.json`
13. `data/interviews.json`
14. `data/story-bank.json`
15. `data/resumes.json`
16. `data/companies.json`
17. every `data/inbox/*.json` where `processed = false`

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
6. Validate assessment records and any explicitly supplied assessment-tracker workbook; merge by `testId`, preserve multiple tests per `jobId`, normalize `testType` as a multi-select array, keep `dueAt`/`completedAt` as `MM-DD`, discard `receivedAt`, and never infer application status from assessment status.
7. Search new Mainland campus HR opportunities.
8. Validate links, freshness, status, job identity, and relevance.
9. Append today's immutable opportunity snapshot by `jobId`, including when the result is zero; never delete prior dates.
10. Write JSON data while preserving `firstRecommendedAt`, `recommendationDate`, `recommendationDates`, and current canonical status.
11. Update the PWA dashboard data and derive approaching assessment events/actions from `data/tests.json`.
12. Generate `data/daily/YYYY-MM-DD.json`.
13. Generate `reports/YYYY-MM-DD_daily-brief.md`.
14. Generate `snapshots/YYYY-MM-DD_campus-dashboard.html`.
15. Append `memory.md` only for durable context.
16. Write `data/handoffs/YYYY-MM-DD_handoff.json`.
17. Run regression tests.
18. Commit when the Git repository is valid.

## Quality Rules

Accuracy beats volume. It is acceptable to recommend 0 opportunities.

Never show a job as ready to apply when the URL, company, title, or active status is unverified.

Closed is not Rejected.

Applied jobs must not remain in the current unsubmitted canonical opportunity collection, but their historical recommendation snapshot membership must remain visible.

Core Introduction is locked by default and cannot be rewritten by an automated daily run.

Story facts are stable facts. Interview review may add answer versions or reflections, but must not rewrite facts unless the user explicitly corrects them.

For an explicitly authorized `SEED_TEST_RUN`, skip the normal time-window restriction only for that run, perform real source searches, write a seed QA report and seed handoff, and restore the normal window for the next `DAILY_RUN`. Never auto-submit applications.

For seed and daily opportunity searches, persist the full target-company status set even when no HR job is found. Store closed historical non-application jobs separately, keep snapshot membership by `jobId`, and expose an apply action only when company, title, sourceJobId and exact URL are verified.
