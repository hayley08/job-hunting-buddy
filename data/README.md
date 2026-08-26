# Data Layer

The dashboard reads these JSON files directly:

- `jobs.json`: unified job recommendations from LinkedIn, JobsDB, BOSS, and future adapters
- `applications.json`: application funnel, todos, and submitted records
- `opportunities.json`: current canonical unsubmitted opportunities
- `historical-opportunities.json`: closed/expired historical recommendations excluded from active pipeline/KPIs
- `opportunity-history.json`: append-only recommendation dates containing canonical `jobId` references; historical membership is never deleted when status changes
- `target-company-watchlist.json`: durable target-company status and evidence from the latest search run
- `jds.json`: complete raw JD snapshots and structured JD knowledge, linked by canonical `jobId`
- `resume.json`: reusable resume content cards with Chinese and English copy

Daily automation should update JSON data only. It should not generate a new HTML dashboard.

Every recommendation preserves `firstRecommendedAt`, `recommendationDate`, `recommendationDates`, and `currentStatus`. Every run appends a snapshot, including a zero-result snapshot. Historical snapshot jobIds resolve across opportunities, historical opportunities, applications, and archive records. `data/daily/latest.json.dataUpdatedAt` is the data freshness timestamp and is independent of the deployed commit returned by `/api/version`.

The explicit single-URL importer writes into these same canonical stores. It
does not create a parallel job table or a second schema.
