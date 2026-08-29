# Hayley HR Job Agent

This package defines the long-running job recommendation architecture.

## Architecture

```text
JobSource
├── LinkedInAdapter
├── JobsDBAdapter
├── BossAdapter
└── SingleUrlAdapter (explicit URL only)

search_job_sources()
↓
normalize_job()
↓
company_quality_filter()
↓
salary_filter()
↓
job_match_filter()
↓
hayley_match_score()
↓
dashboard / Feishu push
```

New platforms should implement `JobSource.search()` and return normalized
`Job` objects. Core filtering and scoring should not be changed for each
platform.

## Unified Job Shape

`Job` contains:

- `title`
- `company`
- `location`
- `source`
- `salary`
- `experience`
- `url`
- `foundDate`
- `jobDescription`
- `companySize`
- `industry`
- `matchScore`
- `matchReason`
- `risk`

For BOSS, `source` is always `BOSS`.

## Single URL Import

```powershell
python -m job_agent.import_url "https://company.example/job/detail"
```

Use `--dry-run` to fetch and normalize without writing. A successful import
reuses `normalize_job()` and the shared dedup keys, then upserts the existing
`data/opportunities.json`, `data/jds.json`, and
`data/opportunity-history.json` stores. It never registers itself in the daily
LinkedIn / JobsDB / BOSS search list.

When the user explicitly reports that the job was submitted:

```powershell
python -m job_agent.import_url "https://company.example/job/detail" --applied-date 2026-08-27
```

This moves the canonical record into the existing application funnel and keeps
its historical recommendation snapshot and JD record intact.

Feishu career detail URLs use the site's public official job-detail API.
Meituan detail URLs use Meituan's official public job-detail API. Other sites
are accepted when the page exposes valid `JobPosting` JSON-LD.
Unsupported or blocked pages fail with an explicit reason and are not saved.

## Feishu Base Data Flow

`job_agent.feishu_sync` consolidates the existing application, opportunity,
historical-opportunity, and JD stores into the generated `data/jobs.json`
mirror. It projects only existing repository field names into Feishu Base.

The 18:00 UTC+8 endpoint first inserts repository/search jobs that are missing
from Feishu by `jobId`, then reads Feishu as the user's editable status/notes
surface, and materializes the result back into the dashboard's existing JSON
stores. Unknown Base fields are ignored and the existing status/JD history is
preserved. Runtime credentials are environment variables and are never stored
in this repository.

## BOSS Adapter Rules

`BossAdapter` is not a one-off scraper. It is a source adapter that:

1. Searches configured keywords and cities.
2. Prefers structured page/API state over brittle DOM card scraping.
3. Supports a cookie file for future logged-in sessions.
4. Returns zero jobs when BOSS blocks direct access or salary/company quality
   cannot be confirmed.

Configured cities:

- 北京
- 上海
- 广州
- 深圳

Configured keywords include:

- 人力, HR, HRBP, COE, 薪酬, 薪酬福利, 人才发展, 组织发展
- Compensation & Benefits, C&B, Talent Development
- Organization Development, Learning & Development, OD
- Employee Experience

## Recommendation Standard

BOSS has uneven company quality, so the pipeline keeps quality high:

- Company quality must be clear: big tech, F500/known MNC, large manufacturing,
  listed company, China 500, World 500, or clear industry leader.
- Salary must be known and monthly lower bound must be at least 12K.
- Admin/recruitment/sales/headhunter/insurance-agent roles are filtered.
- If no BOSS role passes all filters on a given day, return zero BOSS roles.
