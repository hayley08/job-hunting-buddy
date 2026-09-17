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
- The earlier GitHub 443 blocker for `ad7a0ab` was resolved on 2026-09-01: the original commit chain was pushed without recreation/rebase/reset, GitHub and local branch heads matched, and the feature Preview reached Ready. The 18:00 Base workflow still needs its external secrets before it can be enabled.

## 2026-09-01

- `测试` is now a first-level Assessment Tracker. Repository records live in `data/tests.json`; browser-created rows are visibly device-local drafts, stored under `campus-os-assessment-drafts-v1`, and can be exported as a dated `.xlsx` workbook with a `Tests` sheet.
- Company and job title are required text. The optional `jobId` links to an existing canonical job only when safely matched. Assessment status is independent of application status and one job may have multiple tests.
- Assessment deadlines are derived into Home Upcoming and 需要行动. Desktop uses a table and mobile/tablet use stacked cards without whole-page horizontal scrolling. Daily Run must validate and merge returned tracker workbooks without deleting prior assessment records.
- Assessment Tracker commit `c4b4489` reached a Ready Vercel Preview and the stable feature-branch alias was attached to that deployment; later documentation-only deployment-state commits may advance the displayed web SHA.
- Latest Assessment Tracker override: new records default to 海测; there is no received date; only due/completed month-day values are stored and displayed without year/time; test type is multi-select. Any supplied assessment data and preparation analysis must be grounded in the actual user payload, never the earlier QA example workbook.
- The field revision was deployed successfully from commit `3e08705` to the stable feature Preview. Actual assessment data import and written-test analysis remain pending because `data/tests.json` is empty and no accessible source attachment was present; do not mark that data task complete until the real payload is persisted.
- Assessment raw evidence and analysis are permanently separate: append all Excel/image/text/PDF/Word/web inputs to `sourceMaterials`; table focus reads only 3–6 synthesized `assessmentSummary.conciseBullets`. New evidence makes analysis stale and triggers full-set reanalysis; details show categorized analysis plus raw provenance, and conflicts must be explicit rather than resolved by guessing.

## 2026-09-02

- 面试 now mirrors the assessment tracker interaction model without changing its schema: users can create device-local interview drafts from existing company/jobId/round/date/questions fields and export a dated Excel workbook with an `Interviews` sheet. Local drafts do not claim cross-device synchronization.
- A reusable personal Codex skill named `apply-summary` processes complete user-reported applications through the repository's actual schema, normalization, deduplication, JD and storage flows. It preserves raw input/JD before analysis and never substitutes an unrelated job URL.
- User explicitly reported applications to 宝洁 HR Manager (`CNC003210`), 雀巢/太太乐 HR Trainee, ABB Power U 培训生-人力资源 (`JR00044909`), and 宁德时代 人力资源 (`83dd4f41-1db3-4b30-8f6d-48d6bc0349fd`). Full supplied JDs and structured analysis are stored. The Nestlé URL is an official application-history page, so it is preserved as the apply/official URL while JD-link integrity remains unverified.

## 2026-09-03

- User reported 深信服「深信服26届校招-人力资源管培生（nj）」 as Applied on 2026-08-26, plus 联合利华「人力资源部（全国轮岗）」 and 百度「北京-人力资源-COE方向(J101242)」 as Applied on 2026-09-03. Full supplied JDs and structured analyses are stored.
- The Sangfor source conflicts on location (南京 in the listing header, 深圳 in JD) and explicitly targets 2026 graduates; preserve both risks. Sangfor's QR login URL, Unilever's Yingjiesheng personal-center URL, and Baidu's recruitment-center URL are exact user-provided application links but are not verified job-detail URLs.
- User reported “OPPO 给我挂了”; the existing OPPO application is now Rejected with an append-only 2026-09-03 status event and is archived out of active KPI while preserving its application history.
- User reported 地平线「【2027届校招】人力资源管培生(OTD、C&B、绩效等方向)」 as Applied on 2026-09-03. Preserve the supplied Hotjob personal application-history URL as the exact apply link, but do not treat it as a verified JD-detail URL; the complete user-supplied JD and analysis are canonical.
- 流程 now mirrors the local-draft interaction model without introducing a new job schema. `+ 新建流程` creates/updates device-local canonical application records and appends `statusHistory`. Its offline workbook is dated and always orders `流程` as sheet 1 and `测评` as sheet 2; returned workbooks require validated ID-based merge before repo/Feishu synchronization.

## 2026-09-04

- DJI / 大疆's existing 2026-07-17 application now preserves the official personal application-query URL; it remains a link-unverified JD detail page and does not create a duplicate application.
- User reported 快手「HR-组织发展」 as Applied on 2026-08-31. The role is a full-time Beijing OD role posted 2026-08-26, centered on AI transformation, organization design, job architecture, performance/promotion, leadership and talent strategy. Full supplied JD and analysis are canonical; its personal application-history URL is not a verified detail URL.

## 2026-09-16

- User reported 蔚来「校招-人力资源管理培训生 HR Sparks」 (`A73041`) as Applied on 2026-09-07 and 小米「人力资源专员-薪酬」 as Applied on 2026-09-05. Their complete supplied JDs and analyses are canonical; both supplied URLs are official personal application pages, not verified standalone JD-detail links.
- User reported 阿里 and 小鹏 applications as Rejected on 2026-09-09. Alibaba's exact application date and final position title remain unknown, so `appliedDate` stays empty; Xiaopeng retains its 2026-08-27 applied date and exact official job URL. OPPO's existing 2026-09-03 rejection remains unchanged without a duplicate history event.
- The existing 拼多多集团-PDD「HR管培生（上海）」 recommendation was promoted to Applied under the same canonical jobId, removed from active Opportunities, and updated with the exact official position-specific URL and complete user-supplied JD. The user did not provide the submission date, so `appliedDate` stays empty and the 2026-09-16 status event records only the report date.

## 2026-09-18

- User reported the official Envision-group role「培训生-绩效薪酬助理专员-中国/上海市」 (`268efce4-2ef9-4745-8c23-44e6a6ddd6f4`) as Applied. The job page identifies the employer as 远景动力 while the user called it 远景能源; preserve this discrepancy until the actual contracting entity is confirmed.
- The complete performance and compensation JD and exact position-specific URL are canonical. The role covers incentive-plan drafting, HR operations, business-pain-point diagnosis, and process/policy optimization; it requires a master's degree and fluent working English. No exact submission date was supplied, so `appliedDate` remains empty and the 2026-09-18 status event is only the report date.
