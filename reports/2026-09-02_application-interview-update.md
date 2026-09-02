# 2026-09-02 Application and Interview Update

## Interview Tracker

- Added `+ 新建面试` to the existing 面试 panel.
- Drafts reuse the existing interview fields and stay in browser `localStorage` as visible `Local Draft` records.
- Added dated `.xlsx` export with one `Interviews` sheet.
- Added the strict interview JSON schema and desktop/mobile regression coverage.

## Application Summary Imports

| Company | Title | Canonical ID | Applied | JD | Link integrity |
| --- | --- | --- | --- | --- | --- |
| 宝洁 | (Chinese Mainland) Campus Recruiting - Human Resources Manager | `opp-single-url-cnc003210` | 2026-09-02 | Current JD | Official detail verified |
| 雀巢 / 太太乐 | HR Trainee | `app-nestle-hr-trainee-2026-09-02` | 2026-09-02 | Current JD | Application-history URL; JD link unverified |
| ABB | Power U 培训生-人力资源 | `opp-single-url-jr00044909` | 2026-09-01 | Current JD | Exact official Workday URL supplied |
| 宁德时代 | 人力资源 | `opp-single-url-83dd4f41-1db3-4b30-8f6d-48d6bc0349fd` | 2026-09-02 | Current JD | Exact official Moka URL supplied |

All four records preserve complete supplied raw JD separately from structured analysis. No application was submitted by the system.

## Feishu Base

- Deduplication checked by canonical `jobId` before writing.
- Four records were created in the existing 39-field table.
- Read-back verification returned exactly one row per `jobId`, with Applied status, expected title/company, JD status, and non-empty full JD.

## Verification

- Interview module tests passed.
- Single-URL importer tests passed, including entity-encoded JSON-LD HTML.
- Feishu sync tests passed.
- Campus OS V2 regression passed.
- Responsive overflow checks passed across all configured desktop, tablet, and mobile widths.
