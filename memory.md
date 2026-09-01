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
- Verified stable branch alias: `https://job-hunting-buddy-git-feature-campus-688ec5-hayley08s-projects.vercel.app`. Vercel Deployment Protection currently redirects unauthenticated users to Vercel login; the alias itself remains stable and follows the latest successful branch deployment.
- Home must expose data `Last updated` separately from deployed web commit short SHA so mobile users can verify freshness.
- Opportunity recommendations are append-only daily snapshots by canonical `jobId`; date filters preserve historical visibility after later status changes, including zero-result days.
- Completed the 2026-08-23 `SEED_TEST_RUN`: 25 role candidates searched, 13 classified results (3 APPLY_NOW, 1 OPEN, 2 WATCH, 1 UPCOMING, 1 HISTORICAL, 5 VERIFY), 10 excluded and 2 duplicates removed. The baseline, 25-company watchlist, QA report and seed handoff are durable repo sources for the 2026-08-24 12:00 run.
- Exact verified apply/job links in the seed are PDD `452278`, Positec `461662`, SMIC `J13293`, and Beisen `J14756`. Alibaba AI-HR, RichInfo, OneRobotics, Tencent and NIO require re-verification; do not surface apply actions for them.
- Pipeline UX rule: for `Application In Progress`, the job title itself is the red bold hyperlink; do not render a separate continue-apply button in the Pipeline table.

## 2026-08-24

- User reported 中国人保「广东省管培」、米哈游「人力资源（岗位 9221）」和施耐德电气「人力资源实习生（131792）」 as Applied on 2026-08-24. 米哈游 and 中国人保 were transitioned from `Application In Progress` while preserving their 2026-08-23 status history; 施耐德 was added as a new Applied record.
- User supplied complete raw JDs for 米哈游 and 施耐德电气. They are stored and structured in `data/jds.json`; 米哈游 spans HRBP/ER/recruiting, OD/performance/C&B/L&D, employer brand/culture/training and AI workflow, while Schneider spans recruiting, L&D, C&B and HR operations.
- 阿里千问 cartId `100100540113` is explicitly not submitted. Keep it `Application In Progress`, high priority, with empty `appliedDate`, until the user obtains a referral code and confirms submission. Exact title/JD/location remain missing; do not conflate it with the separate Alibaba AI-HR VERIFY opportunity from the seed search.

## 2026-08-26

- Added opt-in single job URL import. It maps real page/API data into the existing `Job` model, shared normalization and dedup keys, then upserts the existing `opportunities.json`, `jds.json`, and `opportunity-history.json` stores. It does not run as part of LinkedIn, JobsDB, or BOSS daily search.
- The importer preserves the exact user URL in all canonical URL fields, stores full raw JD before derived fields, and fails without writing if title/company/JD cannot be verified. Feishu and Meituan career pages use their public official job-detail endpoints; other sites require valid JobPosting JSON-LD.
- Real import baseline: 小鹏集团「【27届校招】HRBP培训生（机器人）」 (`sourceJobId=7669694331025262911`), 深圳, posted 2026-08-03, official URL `https://xiaopeng.jobs.feishu.cn/398875/position/7669694331025262911/detail`. Target-company status moved to OPEN.

## 2026-08-27

- User reported three newly submitted applications: Bambulab「服务运营 - 培训方向」 (`7670507853891455273`), 美团「AI组织转型」 (`4694828828`), and 小鹏集团「【27届校招】HRBP培训生（机器人）」 (`7669694331025262911`). All use `appliedDate = 2026-08-27`, preserve the exact user URLs and full official JDs, and live only in `data/applications.json`, not current Opportunities.
- Meituan single-URL parsing now uses `/api/official/job/getJobDetail`; this job is in 北京/上海 under 人力资源平台 and its full JD covers AI-driven organization transformation, organization/talent research, HRAI products, talent review, level review, and HC budgeting.
- The single-URL CLI supports `--applied-date YYYY-MM-DD` to transition an imported canonical job into the existing application funnel without losing its JD or historical snapshot.
- Fixed the desktop Pipeline/JD grid alignment: cells now stretch to the complete row height, so variable-length notes no longer produce staggered horizontal separators. Responsive regression now checks cell-bottom alignment as well as page overflow across all supported viewport widths.

## 2026-08-28

- The user-provided August 28 resume is the current website resume version (`2026-08-28-resume`); the August 22 migration version remains available as history.
- Current resume scope is two education entries (CUHK MSc and Nanchang University BBA), plus Binance C&B, Aon Talent Development, Midea Compensation & Performance, JD.com Industry HRBP, and Skills & Languages. The current version does not include the older ByteDance/TikTok entry.
- Updated durable facts include Binance completion in July 2026, four wellness sessions, Vietnam headcount growth of 50% with total premium growth controlled at 20%, AI-enabled Wellbeing Portal and insurance Q&A agent, plus revised Aon/Midea/JD responsibilities and metrics.
- Public resume contact fields remain redacted. Do not publish the phone number or email from a private resume attachment unless the user explicitly authorizes it.

## 2026-08-29

- User re-confirmed the existing Insta360 / 影石 HRBP助理 application and supplied its official application-history URL. Reuse the existing full JD; do not create a duplicate.
- User also confirmed Hitachi and Anker applications. Their exact user-provided URLs are preserved, but both point to a careers landing/application-history page that does not expose the specific job while logged out. Keep the records Applied with `JD Missing` and open pending items until a screenshot or exact job detail URL identifies title, requisition ID, city, and JD; never substitute a similar public posting.
- The durable data-management direction is now job search -> Feishu Base -> generated `data/jobs.json` -> existing dashboard stores. Feishu is the daily editing surface, while the current schema, normalization, deduplication, history, adapters, and static dashboard remain authoritative and must be reused.
- Feishu-to-dashboard refresh must run automatically every day at 18:00 UTC+8 without Codex/token usage. No Feishu, GitHub, webhook, or deployment secret may be committed. Initial table inspection is blocked until the user grants Feishu Base read/write authorization.
- Feishu authorization was granted and the target `秋招面板底表` was initialized from the repo schema: 39 existing-schema fields and 34 unique job records. The original five empty placeholder rows were removed. Bot read access is verified.
- The sync implementation uses `/api/sync-feishu`: repository/search additions missing in Base are inserted by `jobId`, Base edits generate `data/jobs.json`, and the same code materializes the dashboard's existing application/opportunity/historical/JD stores. Enabling the 18:00 Base workflow still requires Preview-only Vercel secrets and a GitHub fine-grained Contents token; deployment protection also requires an automation bypass secret.
- Local implementation commit `ad7a0ab` could not be pushed after three attempts because GitHub 443 reset/timed out. Do not recreate, rebase, or reset it; retry the same feature-branch push later, then verify the Vercel Preview before enabling the Base workflow.

## 2026-09-01

- `测试` is now a first-level Assessment Tracker. Repository records live in `data/tests.json`; browser-created rows are visibly device-local drafts, stored under `campus-os-assessment-drafts-v1`, and can be exported as a dated `.xlsx` workbook with a `Tests` sheet.
- Company and job title are required text. The optional `jobId` links to an existing canonical job only when safely matched. Assessment status is independent of application status and one job may have multiple tests.
- Assessment deadlines are derived into Home Upcoming and 需要行动. Desktop uses a table and mobile/tablet use stacked cards without whole-page horizontal scrolling. Daily Run must validate and merge returned tracker workbooks without deleting prior assessment records.
