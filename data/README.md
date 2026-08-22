# Data Layer

The dashboard reads these JSON files directly:

- `jobs.json`: unified job recommendations from LinkedIn, JobsDB, BOSS, and future adapters
- `applications.json`: application funnel, todos, and submitted records
- `resume.json`: reusable resume content cards with Chinese and English copy

Daily automation should update JSON data only. It should not generate a new HTML dashboard.
