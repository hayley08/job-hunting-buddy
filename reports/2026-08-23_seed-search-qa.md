# 2026-08-23 Campus Opportunity Seed Search QA

Run type: `SEED_TEST_RUN`  
Market: Mainland China  
Search target: 2027 campus / fresh graduate / junior 0–3 years HR  
Captured at: 2026-08-23 21:30 UTC+8  
Normal processing window: bypassed for this seed only. The next `DAILY_RUN` uses 2026-08-23 12:00 through 2026-08-24 11:59 UTC+8.

## QA Counts

| Metric | Count |
| --- | ---: |
| 搜索总候选数 | 25 |
| 去重后唯一候选 | 23 |
| 通过初筛 | 13 |
| 推荐立即投递 / APPLY_NOW | 3 |
| 当前可投 / OPEN | 1 |
| Watch | 2 |
| Upcoming | 1 |
| Historical | 1 |
| Verify | 5 |
| Excluded | 10 |
| Duplicate removed | 2 |
| Broken links | 0 |
| Unverified links | 9 |
| 4+ years rejected | 0 |
| Pure recruitment rejected | 2 |
| Expired / wrong cohort rejected | 6 |
| JD captured | 9 |
| JD Missing | 4 |

Unverified links include company/project-level watch URLs, historical/closed pages, P3 leads, and source-status conflicts. They are intentionally not rendered as one-click application links.

## Sources Searched

### Successful

- P0 official: SMIC exact J13293 detail; PDD 2027 campus programme; ByteDance, Huawei, BYD, Midea, Meituan, Unilever, Jabil and other company campus/careers surfaces; RichInfo official page; OneRobotics official campus portal.
- P2: Nowcoder exact pages for PDD, Positec, SMIC cross-check, Beisen, RichInfo, Alibaba AI-HR and Agora; university/campus recruitment pages for company-level corroboration.
- P3 Lead: Tencent HR trainee and NIO OD internship. Both remain `VERIFY` because no matching official/P1/P2 exact job page was found.

### Failed or limited

- BOSS直聘 adapter: public search did not yield a stable, independently verifiable exact-job URL during this run; no BOSS result was promoted.
- LinkedIn adapter: no exact mainland 2027 HR result with a stable public job page was found; no LinkedIn result was promoted.
- RichInfo official vacancy feed: official campus page returned 0 jobs while Nowcoder showed an active exact role. Result downgraded to `VERIFY`.
- Alibaba AI-HR: exact page displayed `已结束` while also showing a future application end date. Result downgraded to `VERIFY`.
- Tencent and NIO: only P3 leads survived; exact official pages were not found.
- OneRobotics: official portal and a current 2027 announcement list the HR title, but the official adapter did not expose an independent job detail/sourceJobId.

## Top Recommendations

1. **宝时得科技 — 2027应届生-人力资源专员 — 9.6/10 — APPLY_NOW**  
   JD combines talent review, succession planning, OD, engagement, organization-health analytics and HR digital tools. This maps directly to Aon competency assessment/C&B/TD, JD.com HC planning, and the user's HR data/AI automation work. Risk: Suzhou and third-party exact application page.
2. **阿里巴巴 — AI-HR数字化专员 — 9.5/10 — VERIFY**  
   Best content fit: HR modules + LLM/RPA MVP + HR data governance + organization health/high-potential analysis. Risk: page status conflict; no apply link exposed.
3. **拼多多 — HR管培生（上海-2027届） — 9.4/10 — APPLY_NOW**  
   The process/information-efficiency direction covers lifecycle, performance, C&B, training, HRIS, analytics and employee experience. Risk: direction allocation must be confirmed.
4. **中芯国际 — 人力资源-张江 J13293 — 9.1/10 — APPLY_NOW**  
   Exact official 2027 role across talent, organization, performance, C&B and employee service in a priority semiconductor platform. Risk: master's degree required and final HR module unspecified.
5. **声网 — HR管培生 — 8.8/10 — HISTORICAL**  
   Excellent COE/HRBP/employee-experience template and a strong fit for future similar roles, but the page explicitly says closed.

## Search Failures

- No verified current 2027 HR opening was found for most high-priority target companies, including P&G, Unilever, JD.com, Volkswagen, Panasonic, XPeng, Chery, Seres and Dreame.
- P0 exact job detail coverage was narrow: only SMIC was both official and exact. PDD was official at programme level and exact at P2.
- Search engines frequently surfaced 2025/2026 pages whose application date fields extended into 2027; those were not treated as 2027 opportunities.

## Adapter Failures

- `BOSS`: stable public exact-job URLs unavailable in this run.
- `LinkedIn`: no public exact mainland 2027 HR result survived validation.
- `RichInfo official`: vacancy count contradicted the P2 exact listing.
- `Alibaba official`: no exact official AI-HR sourceJobId page located.
- `Tencent official`: no exact HR trainee job located.
- `NIO official`: no exact OD internship page located.

## Low-confidence Results

- Tencent HR trainee: P3 only; keep as lead, not application.
- NIO OD intern: P3 only; master's/time-commitment constraints and official identity still need verification.
- OneRobotics HR specialist: current 2027 title and company portal exist, but exact JD/sourceJobId missing.
- RichInfo HR trainee: P2 active versus P0 zero-vacancy conflict.
- Alibaba AI-HR: highly relevant JD but contradictory page status.

## Excluded Candidates

| Candidate | Reason |
| --- | --- |
| 上海人工智能实验室 HR全球化招聘运营 | Pure recruitment / talent mapping concentration; excluded from broad HR priority. |
| 上海砺星工业管培生 | Rotation is mainly operations, sales, presales and after-sales; HRBP is only a possible later destination. |
| 金山云 OD 2026 | Wrong cohort and closed/expired. |
| 北森 senior HRBP lead | Experience barrier and closed/recruitment-heavy signal. |
| Reckitt OD Preview | Expired 2026 internship. |
| 东软技术管培生 | Wrong function and 2026 cohort. |
| FANUC 职能管培 | 2026 cohort and page ended. |
| 精智达 HR专员 | 2026 cohort, ended, and heavily recruiting-oriented. |
| Roche StartUp programme | No HR track in the surfaced programme. |
| Anonymous HRBP aggregator result | Company identity could not be validated; link integrity failed. |

## Duplicate Removal

- RichInfo BeBee mirror removed in favor of the canonical Nowcoder record plus official-company cross-check.
- Repeated OneRobotics community/university announcements collapsed into one company/title lead pointing to the official campus portal.

## Link Integrity Result

- Verified exact job/apply links: PDD `452278`, Positec `461662`, SMIC `J13293`, Beisen `J14756`.
- Broken HTTP/page-not-found links promoted: 0.
- Exact-link identity not verified: 9; every one is labelled `链接待核实` and has no apply action.
- No applications were submitted.

## Baseline Decision

The seed establishes a quality-first baseline of 13 classified records and a 25-company watchlist. Tomorrow's run must retain these canonical jobIds, update status rather than delete history, search missed target companies, revisit the five `VERIFY` records, and avoid the ten documented exclusion patterns.
