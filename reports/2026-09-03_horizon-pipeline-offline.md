# Horizon Application And Pipeline Offline Tracker

## Application

- Canonical ID: `app-horizon-hr-management-trainee-otd-cb-performance-2026-09-03`
- Company/title: 地平线 / 【2027届校招】人力资源管培生(OTD、C&B、绩效等方向)
- Status: Applied on 2026-09-03 (explicit user report)
- Location/update: 北京 / 2026-08-10
- Link integrity: the exact user-supplied Hotjob personal application-history URL is preserved as `applyUrl` and `officialUrl`; `jdUrl` remains empty because the URL is not an exact public detail page.
- JD: complete supplied source is retained in the canonical application and JD store, with separate grounded analysis.
- Feishu: inserted once by canonical `jobId` and read back with Applied date, URL, JD status and link status verified.

## JD analysis

The role is an unusually strong fit because it explicitly combines HR analytics, organizational effectiveness, AI tools, data modeling, trend forecasting and attribution analysis with OTD, C&B and performance directions. The main open questions are early-internship availability and the actual direction/rotation assignment.

## Pipeline offline workflow

- `+ 新建流程` creates a new canonical-shaped Local Draft or overlays an existing application by `jobId`.
- Status updates append the existing `statusHistory` rather than replacing history.
- `导出 Excel` creates a dated workbook with sheet 1 `流程` and sheet 2 `测评`.
- Structured histories, match analysis, assessment summaries and raw assessment materials are JSON-serialized for round-trip preservation.
- Offline edits must be returned for validation and ID-based merge; they are not automatically synchronized to GitHub or Feishu.
