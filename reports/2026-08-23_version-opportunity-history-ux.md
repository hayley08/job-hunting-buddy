# Version Visibility and Opportunity History UX - 2026-08-23

## Home Version Information

- Added an independent structured-data timestamp sourced from `data/daily/latest.json.dataUpdatedAt`.
- Added the deployed web commit short SHA sourced from `/api/version` and Vercel's `VERCEL_GIT_COMMIT_SHA`.
- Data freshness and code deployment identity are displayed separately on the home page.

## Opportunity History

- Added `data/opportunity-history.json` as an append-only snapshot index.
- Snapshot entries contain `recommendationDate`, `capturedAt`, and canonical `jobIds`.
- Preserved the existing zero-result runs for 2026-08-22 and 2026-08-23.
- Added 机会 filters for 全部 and every available `MM/DD` snapshot date.
- Historical entries resolve across applications, current opportunities, and archive data so later status changes do not erase an earlier recommendation.

## Daily Run Contract

- Every run appends a dated snapshot, even when zero jobs qualify.
- Recommended jobs preserve `firstRecommendedAt`, `recommendationDate`, `recommendationDates`, and `currentStatus` when moving between canonical collections.
- Prior snapshot dates and job membership must never be replaced or deleted.

## Validation

- Regression suite passed.
- Responsive overflow checks passed at all configured desktop, tablet, and mobile widths.
