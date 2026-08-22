# JD Knowledge Implementation - 2026-08-23

## Scope

Added a JD sub-tab inside 流程. JD is not a first-level navigation item.

## Data

- Added `data/jds.json`.
- JD records link to canonical jobs by `jobId`.
- Raw JD is preserved before any summary.
- JD Missing records are explicit and do not contain generated summaries.

## Backfill

- Structured JD backfilled: 4
  - Texas Instruments
  - Insta360 / 影石
  - Shopee
  - DJI / 大疆
- JD Missing records: 22
  - OPPO has application/link context but no raw JD text yet.
  - Archived Hong Kong applications do not have raw JD text.
  - User reminder-list roles do not have raw JD text yet.

## Long JD Handling

Texas Instruments is retained as the long-JD example. The full raw JD is saved in JSON, while the UI shows summary, distinctive keywords, requirements, and key original excerpts first. Full JD is collapsed by default.

## Validation

Regression tests verify:

- Raw JD is preserved.
- Missing JD does not generate summary or excerpts.
- `jdKeyOriginalExcerpt` is a verbatim substring of raw JD/snapshot.
- `jdHash` is stable.
- `jdVersions` contains the current hash.
- Interview Pack refresh is marked only for captured new/changed JD.
