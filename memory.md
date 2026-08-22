# Memory

## 2026-08-22

- Project upgraded from Hong Kong HR dashboard into Campus Job Search OS V2.
- Active market is Mainland China 2027 campus recruitment HR roles.
- Hong Kong historical jobs and applications are preserved as archive-only records and excluded from active KPI/search.
- PWA + GitHub + Vercel + JSON is the target architecture.
- Daily run time is 12:00 Asia/Shanghai, processing yesterday 12:00 through today 11:59.
- Core Introduction in Story Bank is locked and currently marked `Needs User Input`.
- Story Bank has been scaffolded from known resume experience themes; facts still need user confirmation.
- Workspace Git metadata is invalid, so `feature/campus-job-os-v2` and commits are blocked until the repository is repaired or moved into a valid GitHub repo.

## 2026-08-23

- Backfilled 5 Mainland applied campus HR roles from user input: TI, OPPO, Insta360, Shopee, DJI.
- TI application requires English interview preparation.
- Applied roles were kept out of opportunities.
- Reminder list policy fixed: pipeline reminders are explicit-only, not auto-generated from target companies or archive records.
- Added 15 user-image reminder entries from "更新目前投递公司" for 外企 and 汽车 roles.
- Added JD Knowledge as a 流程 sub-tab with `data/jds.json`; raw JD is preserved, excerpts must come from original text, and missing JD is explicit.
- Backfilled structured JD records for Texas Instruments, Insta360, Shopee, and DJI; OPPO, archived HK roles, and reminder-list roles are marked JD Missing until raw JD is provided.
- Fixed global responsive width: Pipeline and JD rows now use adaptive grids/cards; automated Chrome overflow checks cover 1440, 1280, 1024, 768, 430, 390, and 375 widths.
