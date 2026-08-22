# 2026-08-23 UI / Information Architecture Refactor

## Scope

This update refactors the PWA navigation and key work surfaces on `feature/campus-job-os-v2`.

## Navigation

Final first-level navigation:

- 首页
- 机会
- 流程
- 面试
- 我的

Story Bank and Resume Copy Tool are modules inside the 面试 tab, not first-level navigation items.

## Desktop / Tablet

Desktop and tablet use a fixed left sidebar with the five first-level tabs.

## Mobile

Mobile uses a hamburger-triggered left drawer. The previous six-item bottom navigation was removed.

## Pipeline

The 流程 tab now uses a banner, compact KPI strip, filter row, and dense table.

Table columns:

- 公司
- 岗位
- Base
- 投递/记录日期
- 当前进度
- 下一节点
- 备注

Job title links open external JD/apply URLs. Clicking a row opens a detail drawer with JD, link, timeline, notes, interview pack, and historical reference.

## Data Sources Displayed in Pipeline

Pipeline rows combine:

- Applications
- Opportunities
- Target Company Watchlist
- Historical archived HR opportunities

Rows are visually separated through row labels and status badges.

## 面试 Tab

The 面试 tab contains:

1. Interview Records
2. Resume Copy Tool
3. Story Bank

Resume Copy Tool was restored from the legacy `resumeClips` pattern and the migrated `data/resumes.json` sections. It keeps Chinese and English copy buttons and adds bullet-level Chinese copy where available.

## Validation

- JSON validation passed
- `tests/regression_v2.py` passed
- Static resource serving passed
- URL format integrity passed
- JS syntax check passed
