# Memory

## 2026-08-22

- Project upgraded from Hong Kong HR dashboard into Campus Job Search OS V2.
- Active market is Mainland China 2027 campus recruitment HR roles.
- Hong Kong historical jobs and applications are preserved as archive-only records and excluded from active KPI/search.
- PWA + GitHub + Vercel + JSON is the target architecture.
- Daily run time is 12:00 Asia/Shanghai, processing yesterday 12:00 through today 11:59.
- Core Introduction in Story Bank is locked and currently marked `Needs User Input`.
- Story Bank has been scaffolded from known resume experience themes; facts still need user confirmation.
- The original generated workspace had invalid Git metadata; the formal repository at `C:\Users\dscwife\Documents\Codex\2026-07-02\job-hunting-buddy` is valid and `feature/campus-job-os-v2` is the only working branch for V2.

## 2026-08-23

- Backfilled 5 Mainland applied campus HR roles from user input: TI, OPPO, Insta360, Shopee, DJI.
- TI application requires English interview preparation.
- Applied roles were kept out of opportunities.
- Reminder list policy fixed: pipeline reminders are explicit-only, not auto-generated from target companies or archive records.
- Added 15 user-image reminder entries from "更新目前投递公司" for 外企 and 汽车 roles.
- Added JD Knowledge as a 流程 sub-tab with `data/jds.json`; raw JD is preserved, excerpts must come from original text, and missing JD is explicit.
- Backfilled structured JD records for Texas Instruments, Insta360, Shopee, and DJI; OPPO, archived HK roles, and reminder-list roles are marked JD Missing until raw JD is provided.
- Fixed global responsive width: Pipeline and JD rows now use adaptive grids/cards; automated Chrome overflow checks cover 1440, 1280, 1024, 768, 430, 390, and 375 widths.
- Added long-term `Application In Progress` / 投递中 status. 米哈游、中国人保、联想 are marked 投递中 with applyUrl, applicationStartedAt = 2026-08-23, empty appliedDate, high-priority pending action, and JD Missing.
- Added the cross-thread persistence rule: material requirements, overrides, and raw job/application facts must be persisted in the repository and meaningful completed work committed; chat history is never the source of truth.
- V2 daily access must use the stable Vercel branch URL for `feature/campus-job-os-v2`, not immutable commit Preview URLs. PWA navigation, app-shell assets, and JSON are network-first with offline cache fallback; JSON is always freshness-first while online.
- Home must expose data `Last updated` separately from deployed web commit short SHA so mobile users can verify freshness.
- Opportunity recommendations are append-only daily snapshots by canonical `jobId`; date filters preserve historical visibility after later status changes, including zero-result days.
- Completed the 2026-08-23 `SEED_TEST_RUN`: 25 role candidates searched, 13 classified results (3 APPLY_NOW, 1 OPEN, 2 WATCH, 1 UPCOMING, 1 HISTORICAL, 5 VERIFY), 10 excluded and 2 duplicates removed. The baseline, 25-company watchlist, QA report and seed handoff are durable repo sources for the 2026-08-24 12:00 run.
- Exact verified apply/job links in the seed are PDD `452278`, Positec `461662`, SMIC `J13293`, and Beisen `J14756`. Alibaba AI-HR, RichInfo, OneRobotics, Tencent and NIO require re-verification; do not surface apply actions for them.
- Pipeline UX rule: for `Application In Progress`, the job title itself is the red bold hyperlink; do not render a separate continue-apply button in the Pipeline table.
