# Data Layer

The dashboard reads these JSON files directly:

- `jobs.json`: unified job recommendations from LinkedIn, JobsDB, BOSS, and future adapters
- `applications.json`: application funnel, todos, and submitted records
- `opportunities.json`: current canonical unsubmitted opportunities
- `opportunity-history.json`: append-only recommendation dates containing canonical `jobId` references; historical membership is never deleted when status changes
- `resume.json`: reusable resume content cards with Chinese and English copy

Daily automation should update JSON data only. It should not generate a new HTML dashboard.

Every recommendation preserves `firstRecommendedAt`, `recommendationDate`, `recommendationDates`, and `currentStatus`. Every run appends a snapshot, including a zero-result snapshot. `data/daily/latest.json.dataUpdatedAt` is the data freshness timestamp and is independent of the deployed commit returned by `/api/version`.
