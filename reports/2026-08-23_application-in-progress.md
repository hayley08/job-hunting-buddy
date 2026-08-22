# Application In Progress Status - 2026-08-23

## New Long-Term Status

Added `Application In Progress` / `投递中` for applications that have been started but not finally submitted.

This status is distinct from:

- `待投递`: not started.
- `投递中`: application flow started, final submission not confirmed.
- `已投递`: final submission confirmed.

## Data Added

Three user-provided in-progress applications were added:

- 米哈游 · 校园招聘岗位 9221
- 中国人保 · 校园招聘岗位
- 联想 · 校园招聘简历投递

Each record stores:

- `currentStatus = Application In Progress`
- `applicationStartedAt = 2026-08-23`
- empty `appliedDate`
- `applyUrl`
- high-priority action notes
- `statusHistory` event preserving the started-but-not-submitted state

## UI

- Added 流程 sub-filter: `投递中`.
- Homepage now shows `投递中` KPI and a high-priority `需要行动` section.
- Pipeline rows use a red warning style and show `继续投递` when `applyUrl` exists.

## Daily Run Rule

Daily Run must keep all `Application In Progress` jobs in unfinished-application reminders until the user confirms final submission.
