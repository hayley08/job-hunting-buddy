# Hayley HR Job Agent

This package defines the long-running job recommendation architecture.

## Architecture

```text
JobSource
├── LinkedInAdapter
├── JobsDBAdapter
└── BossAdapter

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

