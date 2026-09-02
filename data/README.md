# Data Layer

The dashboard reads these JSON files directly:

- `jobs.json`: unified job recommendations from LinkedIn, JobsDB, BOSS, and future adapters
- `applications.json`: application funnel, todos, and submitted records
- `opportunities.json`: current canonical unsubmitted opportunities
- `historical-opportunities.json`: closed/expired historical recommendations excluded from active pipeline/KPIs
- `opportunity-history.json`: append-only recommendation dates containing canonical `jobId` references; historical membership is never deleted when status changes
- `target-company-watchlist.json`: durable target-company status and evidence from the latest search run
- `jds.json`: complete raw JD snapshots and structured JD knowledge, linked by canonical `jobId`
- `tests.json`: assessment tracker records, independently linked to canonical jobs by optional `jobId`
- `interviews.json`: persistent interview records; browser-created drafts use the same fields and merge later by `interviewId`
- `assessment-materials/`: append-only original assessment files referenced by `sourceMaterials.storageRef`
- `resume.json`: reusable resume content cards with Chinese and English copy

Daily automation should update JSON data only. It should not generate a new HTML dashboard.

Every recommendation preserves `firstRecommendedAt`, `recommendationDate`, `recommendationDates`, and `currentStatus`. Every run appends a snapshot, including a zero-result snapshot. Historical snapshot jobIds resolve across opportunities, historical opportunities, applications, and archive records. `data/daily/latest.json.dataUpdatedAt` is the data freshness timestamp and is independent of the deployed commit returned by `/api/version`.

The explicit single-URL importer writes into these same canonical stores. It
does not create a parallel job table or a second schema.
If the user reports the URL as submitted, the same canonical `jobId` moves to
`applications.json`; its JD record and opportunity-history membership remain.

Assessment records follow `data/schemas/tests.schema.json`. `testType` is an array, `assessmentScope` defaults to 海测 at creation, and only yearless `MM-DD` due/completed dates are retained. Append-only `sourceMaterials` preserves raw evidence; separately derived `assessmentSummary` is the only source for table focus bullets, and its source ID coverage controls whether analysis is current or stale. Browser-created rows remain device-local drafts until a validated Excel import or Daily Run writes them to this file; assessment status never changes application status automatically.

Interview records follow `data/schemas/interviews.schema.json`. A browser draft uses `campus-os-interview-drafts-v1`, stays visibly local, and exports to a dated `.xlsx` workbook with an `Interviews` sheet. It does not imply cross-device or Git synchronization.
