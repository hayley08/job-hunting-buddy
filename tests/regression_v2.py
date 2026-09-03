import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    applications = load_json("data/applications.json")
    opportunities = load_json("data/opportunities.json")
    historical_opportunities = load_json("data/historical-opportunities.json")
    opportunity_history = load_json("data/opportunity-history.json")
    archive_data = load_json("data/archive.json")
    archive = archive_data if isinstance(archive_data, list) else archive_data.get("records", [])
    story_bank = load_json("data/story-bank.json")
    resumes = load_json("data/resumes.json")
    resume_mirror = load_json("data/resume.json")
    reminders = load_json("data/reminders.json")
    jds = load_json("data/jds.json")
    jobs = load_json("data/jobs.json")
    pending = load_json("data/pending.json")
    tests = load_json("data/tests.json")
    tests_schema = load_json("data/schemas/tests.schema.json")
    interviews = load_json("data/interviews.json")
    interviews_schema = load_json("data/schemas/interviews.schema.json")
    handoff = load_json("data/handoffs/2026-08-22_handoff.json")

    job_ids = [item.get("jobId") for item in applications + opportunities + historical_opportunities + archive if item.get("jobId")]
    assert_true(len(job_ids) == len(set(job_ids)), "duplicate jobId detected")
    mirror_ids = [item.get("jobId") for item in jobs]
    expected_mirror_ids = {item.get("jobId") for item in applications + opportunities + historical_opportunities if item.get("jobId")}
    assert_true(len(mirror_ids) == len(set(mirror_ids)), "duplicate jobId detected in data/jobs.json")
    assert_true(set(mirror_ids) == expected_mirror_ids, "data/jobs.json must mirror the existing dashboard job stores")

    active_apps = [item for item in applications if item.get("market") == "Mainland" and not item.get("archived")]
    active_opps = [item for item in opportunities if item.get("market") == "Mainland" and not item.get("archived")]
    archived_hk = [item for item in archive if item.get("market") == "HongKong" and item.get("archived") is True]

    assert_true(len(archived_hk) == len(archive), "archive contains non-archived or non-HK record")
    assert_true(all(item.get("market") == "Mainland" for item in active_apps), "non-Mainland active application detected")
    assert_true(all(item.get("market") == "Mainland" for item in active_opps), "non-Mainland active opportunity detected")

    applied_ids = {item.get("jobId") for item in applications if item.get("currentStatus") == "Applied"}
    opportunity_ids = {item.get("jobId") for item in opportunities}
    assert_true(not applied_ids.intersection(opportunity_ids), "applied job appears in opportunities")

    snapshots = opportunity_history.get("snapshots", [])
    snapshot_dates = [item.get("recommendationDate") for item in snapshots]
    assert_true(len(snapshot_dates) == len(set(snapshot_dates)), "opportunity snapshot date must be unique and append-only")
    assert_true({"2026-08-22", "2026-08-23", "2026-08-26", "2026-08-27"}.issubset(set(snapshot_dates)), "historical and URL-import snapshots must be preserved")
    canonical_ids = {item.get("jobId") for item in applications + opportunities + historical_opportunities + archive if item.get("jobId")}
    assert_true(all(set(item.get("jobIds", [])).issubset(canonical_ids) for item in snapshots), "snapshot must reference canonical jobId values")
    for item in opportunities + historical_opportunities:
        assert_true(item.get("firstRecommendedAt"), f"firstRecommendedAt missing: {item.get('jobId')}")
        assert_true(item.get("recommendationDate"), f"recommendationDate missing: {item.get('jobId')}")
        assert_true(item.get("recommendationDates"), f"recommendationDates missing: {item.get('jobId')}")
        assert_true(item.get("recommendationDate") == item.get("recommendationDates", [None])[0], f"first recommendation date drifted: {item.get('jobId')}")

    in_progress = [item for item in active_apps if item.get("currentStatus") == "Application In Progress"]
    assert_true(len(in_progress) == 2, "expected 2 Application In Progress records")
    assert_true({item.get("company") for item in in_progress} == {"联想", "阿里千问"}, "unexpected Application In Progress companies")
    for item in in_progress:
        assert_true(item.get("applyUrl", "").startswith("https://"), f"Application In Progress must preserve applyUrl: {item.get('jobId')}")
        assert_true(item.get("applicationStartedAt") in {"2026-08-23", "2026-08-24"}, f"applicationStartedAt missing: {item.get('jobId')}")
        assert_true(not item.get("appliedDate"), f"Application In Progress must not have appliedDate: {item.get('jobId')}")
        assert_true(item.get("archived") is False, f"unfinished application must not be archived: {item.get('jobId')}")
        assert_true(any(event.get("status") == "Application In Progress" for event in item.get("statusHistory", [])), f"in-progress status history missing: {item.get('jobId')}")
    applied_kpi_count = sum(1 for item in active_apps if any(event.get("status") == "Applied" for event in item.get("statusHistory", [])) or item.get("currentStatus") == "Applied")
    assert_true(applied_kpi_count == 20, "Application In Progress and archived rejection must not inflate Applied KPI")
    assert_true(next(item for item in active_apps if item.get("company") == "米哈游").get("appliedDate") == "2026-08-24", "miHoYo status transition missing")
    assert_true(next(item for item in active_apps if item.get("company") == "中国人保").get("title") == "广东省管培", "PICC title update missing")
    assert_true(next(item for item in active_apps if item.get("company") == "施耐德电气").get("sourceJobId") == "131792", "Schneider application missing")
    insta360 = next(item for item in active_apps if item.get("company") == "Insta360 / 影石")
    assert_true(insta360.get("applyUrl") == "https://arashivision.jobs.feishu.cn/campus/position/application", "Insta360 application-history URL missing")
    hitachi = next(item for item in active_apps if item.get("jobId") == "app-hitachi-position-pending-2026-08-29")
    anker = next(item for item in active_apps if item.get("jobId") == "app-anker-position-pending-2026-08-29")
    assert_true(hitachi.get("title") == "职位名称待确认" and hitachi.get("appliedDate") == "2026-08-29", "Hitachi pending application missing")
    assert_true(anker.get("title") == "职位名称待确认" and anker.get("appliedDate") == "2026-08-29", "Anker pending application missing")
    pg = next(item for item in active_apps if item.get("sourceJobId") == "CNC003210")
    nestle = next(item for item in active_apps if item.get("jobId") == "app-nestle-hr-trainee-2026-09-02")
    abb = next(item for item in active_apps if item.get("sourceJobId") == "JR00044909")
    catl = next(item for item in active_apps if item.get("sourceJobId") == "83dd4f41-1db3-4b30-8f6d-48d6bc0349fd")
    assert_true(pg.get("company") == "宝洁" and pg.get("currentStatus") == "Applied", "P&G application summary missing")
    assert_true(nestle.get("applyUrl") == "https://app.mokahr.com/campus-recruitment/nestlezgc/91899#/candidateHome/applications" and not nestle.get("jdUrl"), "Nestle application-history URL integrity missing")
    assert_true(abb.get("title") == "Power U 培训生-人力资源" and abb.get("appliedDate") == "2026-09-01", "ABB application summary missing")
    assert_true(catl.get("company") == "宁德时代" and catl.get("currentStatus") == "Applied", "CATL application summary missing")
    sangfor = next(item for item in applications if item.get("jobId") == "app-sangfor-hr-management-trainee-nj-2026-08-26")
    unilever = next(item for item in active_apps if item.get("jobId") == "app-unilever-hr-national-rotation-2026-09-03")
    baidu = next(item for item in active_apps if item.get("sourceJobId") == "J101242")
    horizon = next(item for item in active_apps if item.get("jobId") == "app-horizon-hr-management-trainee-otd-cb-performance-2026-09-03")
    oppo = next(item for item in applications if item.get("jobId") == "app-oppo-human-resources-2026-08-17")
    assert_true(sangfor.get("appliedDate") == "2026-08-26" and "南京" in sangfor.get("location", "") and "深圳" in sangfor.get("location", ""), "Sangfor application or location conflict missing")
    assert_true(unilever.get("appliedDate") == "2026-09-03" and not unilever.get("jdUrl"), "Unilever application-center link semantics missing")
    assert_true(baidu.get("title") == "北京-人力资源-COE方向(J101242)" and not baidu.get("jdUrl"), "Baidu application summary missing")
    assert_true(horizon.get("currentStatus") == "Applied" and horizon.get("appliedDate") == "2026-09-03" and not horizon.get("jdUrl"), "Horizon application/link semantics missing")
    assert_true(oppo.get("currentStatus") == "Rejected" and oppo.get("archived") is True and any(event.get("status") == "Rejected" for event in oppo.get("statusHistory", [])), "OPPO rejection status/history missing")
    qwen = next(item for item in active_apps if item.get("company") == "阿里千问")
    assert_true(qwen.get("currentStatus") == "Application In Progress" and not qwen.get("appliedDate"), "Qwen must remain not submitted")

    for item in applications:
        if item.get("currentStatus") == "Closed":
            assert_true(item.get("currentStatus") != "Rejected", "Closed counted as Rejected")
        assert_true(isinstance(item.get("statusHistory"), list), f"missing statusHistory: {item.get('jobId')}")

    core = story_bank.get("coreIntroduction", {})
    assert_true(core.get("locked") is True, "core introduction must remain locked")
    assert_true(core.get("introCN60") == "Needs User Input", "core introduction changed unexpectedly")
    assert_true(len(story_bank.get("stories", [])) >= 17, "initial Story Bank scaffold incomplete")

    assert_true(resumes.get("currentVersion") == "2026-08-28-resume", "August 28 resume must be current")
    resume_versions = {item.get("version"): item for item in resumes.get("versions", [])}
    assert_true({"2026-08-22-migration", "2026-08-28-resume"}.issubset(resume_versions), "resume history must be preserved")
    current_resume = resume_versions["2026-08-28-resume"]
    current_section_ids = [item.get("sectionId") for item in current_resume.get("sections", [])]
    assert_true(current_section_ids == ["education-cuhk", "education-ncu", "binance", "aon", "midea", "jd", "skills-languages"], "current resume sections drifted")
    assert_true("tiktok" not in current_section_ids and "bytedance" not in current_section_ids, "current resume must match the attached source")
    old_section_ids = {item.get("sectionId") for item in resume_versions["2026-08-22-migration"].get("sections", [])}
    assert_true({"tiktok", "bytedance"}.issubset(old_section_ids), "historical resume content was overwritten")
    current_profile = current_resume.get("profile", {})
    assert_true(current_profile.get("email") == "[redacted-email]" and current_profile.get("phone") == "[redacted-phone]", "public contact details must stay redacted")
    binance_resume = next(item for item in current_resume.get("sections", []) if item.get("sectionId") == "binance")
    assert_true(all(term in binance_resume.get("contentCN", "") for term in ["HC增长50%", "总保费涨幅控制在20%", "4场", "Wellbeing Portal", "保险问答Agent"]), "updated Binance resume facts missing")
    assert_true([item.get("id") for item in resume_mirror.get("sections", [])] == current_section_ids, "legacy resume mirror is out of sync")

    git_pending = next(item for item in pending if item.get("pendingId") == "pending-git-branch")
    assert_true(git_pending.get("status") == "resolved", "obsolete Git blocker must be resolved in formal repository")
    assert_true(handoff.get("runDate") == "2026-08-22", "handoff missing or wrong date")
    assert_true(isinstance(tests, list), "assessment store must be a JSON array")
    assert_true(isinstance(interviews, list), "interview store must be a JSON array")
    assert_true(interviews_schema.get("items", {}).get("additionalProperties") is False, "interview schema must reject unplanned fields")
    assert_true(set(interviews_schema.get("items", {}).get("required", [])) == {"interviewId", "company", "jobId", "round", "date", "questions", "sourceOfTruth", "createdAt", "updatedAt"}, "interview schema must reuse the canonical record fields")
    assessment_properties = tests_schema.get("items", {}).get("properties", {})
    assert_true(tests_schema.get("type") == "array" and tests_schema.get("items", {}).get("additionalProperties") is False, "assessment schema must reject unplanned fields")
    assert_true(assessment_properties.get("testType", {}).get("type") == "array", "assessment testType must be multi-select")
    assert_true("receivedAt" not in assessment_properties, "assessment schema must not retain receivedAt")
    assert_true(assessment_properties.get("dueAt", {}).get("pattern", "").startswith("^(|"), "assessment dates must use yearless MM-DD values")
    assert_true(assessment_properties.get("sourceMaterials", {}).get("type") == "array", "assessment raw sources must be a separate array")
    assert_true("summary" not in assessment_properties and "preparationFocus" not in assessment_properties, "legacy raw text fields must not remain in the assessment schema")
    summary_variants = assessment_properties.get("assessmentSummary", {}).get("oneOf", [])
    summary_object = next((item for item in summary_variants if item.get("type") == "object"), {})
    summary_properties = summary_object.get("properties", {})
    assert_true(summary_properties.get("conciseBullets", {}).get("minItems") == 3 and summary_properties.get("conciseBullets", {}).get("maxItems") == 6, "table summary must contain 3–6 synthesized bullets")
    assert_true(summary_properties.get("preparationAdvice", {}).get("minItems") == 3 and summary_properties.get("preparationAdvice", {}).get("maxItems") == 5, "preparation advice must contain 3–5 actions")
    assert_true(set(assessment_properties.get("analysisStatus", {}).get("enum", [])) == {"NEEDS_SOURCE", "NOT_ANALYZED", "CURRENT", "STALE"}, "assessment analysis freshness states missing")
    assert_true(len(reminders) == 15, "user-image reminder list should contain 15 entries")
    assert_true(all(item.get("sourceOfTruth") == "user" for item in reminders), "reminders must be explicit user-provided records")
    assert_true(all(item.get("status") == "提醒列表" for item in reminders), "reminders must stay in 提醒列表 status")

    jd_ids = [item.get("jobId") for item in jds]
    assert_true(len(jd_ids) == len(set(jd_ids)), "same job must not duplicate JD records")
    expected_jd_ids = {item.get("jobId") for item in applications if item.get("jobId")}
    expected_jd_ids.update(item.get("reminderId") for item in reminders if item.get("reminderId"))
    expected_jd_ids.update(item.get("jobId") for item in opportunities + historical_opportunities if item.get("jobId"))
    assert_true(expected_jd_ids.issubset(set(jd_ids)), "applications and reminders must have JD or JD Missing records")

    complete_jds = [item for item in jds if item.get("jdStatus") != "JD Missing"]
    missing_jds = [item for item in jds if item.get("jdStatus") == "JD Missing"]
    assert_true(len(complete_jds) == 26, "captured JD count must include all analyzed September application records")
    assert_true(len(missing_jds) >= 1, "jobs without JD must be marked JD Missing")
    missing_jd_ids = {item.get("jobId") for item in missing_jds}
    assert_true({hitachi.get("jobId"), anker.get("jobId")}.issubset(missing_jd_ids), "unverified Hitachi/Anker jobs must remain JD Missing")
    for item in jds:
        raw = item.get("jdRaw") or item.get("jdSnapshot") or ""
        if item.get("jdStatus") == "JD Missing":
            assert_true(not item.get("jdSummary"), f"JD Missing must not have generated summary: {item.get('jobId')}")
            assert_true(not item.get("jdKeyOriginalExcerpt"), f"JD Missing must not have generated excerpts: {item.get('jobId')}")
            assert_true(item.get("interviewPackNeedsRefresh") is False, f"missing JD must not refresh interview pack: {item.get('jobId')}")
            continue
        assert_true(raw, f"raw JD must be preserved: {item.get('jobId')}")
        assert_true(item.get("jdSummary"), f"summary exists only after JD is captured: {item.get('jobId')}")
        assert_true(item.get("jdHash") == hashlib.sha256(raw.strip().encode("utf-8")).hexdigest(), f"jdHash unstable or mismatched: {item.get('jobId')}")
        assert_true(item.get("jdVersions"), f"jdVersions missing: {item.get('jobId')}")
        assert_true(item["jdVersions"][-1].get("hash") == item.get("jdHash"), f"latest version hash must equal current JD hash: {item.get('jobId')}")
        assert_true(item.get("interviewPackNeedsRefresh") is True, f"new/changed JD should mark interview pack refresh: {item.get('jobId')}")
        for excerpt in item.get("jdKeyOriginalExcerpt", []):
            assert_true(excerpt in raw, f"JD excerpt must be original substring: {item.get('jobId')} -> {excerpt}")

    ti_jd = next(item for item in jds if item.get("jobId") == "app-texas-instruments-human-resources-generalist-2026-08-19")
    assert_true(len(ti_jd.get("jdRaw", "")) > 1500, "Texas Instruments must be retained as long JD example")
    assert_true("English communication" in ti_jd.get("jdDistinctiveKeywords", []), "TI distinctive keywords must capture English signal")

    xiaopeng_url = "https://xiaopeng.jobs.feishu.cn/campus/position/7669694331025262911/detail"
    xiaopeng = next(item for item in applications if item.get("sourceJobId") == "7669694331025262911")
    assert_true(xiaopeng.get("title") == "【27届校招】HRBP培训生（机器人）", "single URL import title mismatch")
    assert_true(all(xiaopeng.get(key) == xiaopeng_url for key in ("applyUrl", "jdUrl", "officialUrl")), "single URL import changed the original URL")
    assert_true(xiaopeng.get("currentStatus") == "Applied" and xiaopeng.get("appliedDate") == "2026-08-27", "Xiaopeng application transition missing")
    xiaopeng_jd = next(item for item in jds if item.get("jobId") == xiaopeng.get("jobId"))
    assert_true("负责对接业务部门" in xiaopeng_jd.get("jdRaw", "") and "能接受省内短途出差" in xiaopeng_jd.get("jdRaw", ""), "single URL import did not preserve the complete JD")
    existing_application_keys = {key for item in applications if item is not xiaopeng for key in item}
    existing_jd_keys = {key for item in jds if item is not xiaopeng_jd for key in item}
    assert_true(set(xiaopeng).issubset(existing_application_keys), "single URL import added application schema fields")
    assert_true(set(xiaopeng_jd).issubset(existing_jd_keys), "single URL import added JD schema fields")

    bambu = next(item for item in applications if item.get("sourceJobId") == "7670507853891455273")
    meituan = next(item for item in applications if item.get("sourceJobId") == "4694828828")
    assert_true(bambu.get("title") == "服务运营 - 培训方向" and bambu.get("currentStatus") == "Applied", "Bambu Lab application missing")
    assert_true(meituan.get("title") == "AI组织转型" and meituan.get("location") == "北京市/上海市", "Meituan application facts missing")
    assert_true("AI在改变什么底层逻辑" in next(item for item in jds if item.get("jobId") == meituan.get("jobId")).get("jdRaw", ""), "Meituan full JD missing")

    required_files = [
        "index.html",
        "app/app.js",
        "app/assessments.js",
        "app/interviews.js",
        "app/pipeline.js",
        "app/store.js",
        "app/filters.js",
        "app/styles.css",
        "app/vendor/xlsx.full.min.js",
        "manifest.json",
        "service-worker.js",
        "vercel.json",
        "MASTER_REQUIREMENTS.md",
        "ARCHITECTURE_V2.md",
        "SKILL.md",
        "memory.md",
        "data/jds.json",
        "data/tests.json",
        "data/schemas/tests.schema.json",
        "data/schemas/interviews.schema.json",
        "data/historical-opportunities.json",
        "data/opportunity-history.json",
        "data/target-company-watchlist.json",
        "data/daily/latest.json",
        "data/daily/2026-08-23_seed.json",
        "data/handoffs/2026-08-23_seed_handoff.json",
        "job_agent/import_url.py",
        "job_agent/adapters/single_url.py",
        "job_agent/storage.py",
        "reports/2026-08-23_seed-search-qa.md",
        "reports/2026-08-22_daily-brief.md",
    ]
    for path in required_files:
        assert_true((ROOT / path).exists(), f"required file missing: {path}")

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    assert_true("networkFirst" in sw and "/data/" in sw, "service worker must use network-first for JSON data")
    assert_true("cacheFirst" not in sw, "app shell must not remain cache-first")
    assert_true('event.request.mode === "navigate"' in sw, "HTML navigation must use network-first")
    assert_true('pathname.startsWith("/app/")' in sw, "app shell assets must use network-first")
    assert_true('cache: "no-store"' in sw, "online freshness must bypass browser HTTP cache")
    assert_true("normalizedCacheKey" in sw and "url.search = \"\"" in sw, "latest JSON response must replace the same offline fallback cache entry")

    vercel = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    header_rules = {item["source"]: item["headers"][0]["value"] for item in vercel.get("headers", [])}
    assert_true(header_rules.get("/data/(.*).json") == "no-store, max-age=0", "JSON must be no-store on Vercel")
    assert_true("must-revalidate" in header_rules.get("/", ""), "root HTML must revalidate")
    assert_true("must-revalidate" in header_rules.get("/index.html", ""), "index HTML must revalidate")
    assert_true("must-revalidate" in header_rules.get("/app/(.*)", ""), "app assets must revalidate")

    app_js = (ROOT / "app" / "app.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "styles.css").read_text(encoding="utf-8")
    master = (ROOT / "MASTER_REQUIREMENTS.md").read_text(encoding="utf-8")
    assert_true("Cross-Thread Persistence Rule" in master, "cross-thread persistence rule missing")
    assert_true("Version Visibility" in master and "append-only recommendation history" in master, "long-term UX rules missing")
    assert_true('label: "Story"' not in app_js, "Story must not be a first-level tab")
    assert_true('label: "面试"' in app_js, "面试 must be the first-level interview tab")
    assert_true('label: "测试"' in app_js and 'activeTab === "assessments"' in app_js, "测试 must be a first-level tab")
    assert_true("bottom-nav" not in app_js and "bottom-nav" not in css, "bottom navigation must not be restored")
    assert_true("Resume Copy Tool" in app_js and "Story Bank" in app_js, "面试 tab must contain Resume Copy Tool and Story Bank")
    assert_true('label: "投递中"' in app_js, "pipeline must expose Application In Progress filter")
    assert_true("in-progress-job-link" in app_js, "Application In Progress job title must be the continue-apply link")
    assert_true("continue-link" not in app_js, "pipeline must not render a separate continue-apply button")
    assert_true("renderPendingActions" in app_js and "需要行动" in app_js, "Application In Progress must appear in dashboard pending actions")
    assert_true("renderVersionInfo" in app_js and "commitShortSha" in app_js and "dataUpdatedAt" in app_js, "home must show separate data and code versions")
    assert_true("data-opportunity-date" in app_js and "getOpportunitySnapshots" in app_js, "opportunity date history UI missing")
    assert_true("findOpportunityHistoryJob" in app_js, "historical opportunity status must resolve from canonical jobs")
    assert_true("historicalOpportunities" in app_js and "targetCompanyWatchlist" in app_js, "historical opportunity and target watchlist UI must load durable data")
    assert_true(all(label in app_js for label in ["建议立即投递", "当前可投", "持续关注", "即将开放", "往届参考", "待核实"]), "opportunity classification labels missing")
    assert_true('job.linkStatus === "VERIFIED"' in app_js and "链接待核实" in app_js, "unverified links must not render an apply action")
    assert_true('registration.update()' in app_js and '"controllerchange"' in app_js, "PWA must promptly activate and reload after shell updates")
    assert_true("deadlineDistance" in app_js and "距截止还有" in app_js, "deadline approaching should increase unfinished application reminder detail")
    assert_true("preserve the `Application In Progress` event" in master, "Applied transition must preserve Application In Progress history rule")
    assert_true('label: "提醒列表"' in app_js, "pipeline must expose explicit reminder list filter")
    assert_true('label: "JD"' in app_js and "renderJdKnowledge" in app_js, "流程 tab must contain JD Knowledge sub-tab")
    assert_true("state.companies || []" not in app_js, "pipeline must not auto-generate reminders from target companies")
    assert_true("state.archive?.records" not in app_js, "pipeline must not auto-generate reminders from archive records")
    assert_true(".sidebar" in css and ".mobile-topbar" in css and ".pipeline-grid" in css, "sidebar/mobile/responsive pipeline layout CSS missing")
    assert_true(".watchlist-grid" in css and ".opportunity-meta" in css, "responsive opportunity/watchlist styles missing")
    assessments_js = (ROOT / "app" / "assessments.js").read_text(encoding="utf-8")
    interviews_js = (ROOT / "app" / "interviews.js").read_text(encoding="utf-8")
    pipeline_js = (ROOT / "app" / "pipeline.js").read_text(encoding="utf-8")
    assert_true("campus-os-assessment-drafts-v1" in assessments_js and "sourceOfTruth: \"local-draft\"" in assessments_js, "assessment drafts must stay visibly local")
    assert_true("buildAssessmentWorkbook" in assessments_js and '"Tests"' in assessments_js and '"Source Materials"' in assessments_js and "assessment-tracker.xlsx" in assessments_js, "Excel assessment/source export missing")
    assert_true("CSV" not in app_js and "导出 Excel" in app_js, "assessment page must export Excel rather than CSV")
    assert_true(all(text in assessments_js for text in ["公司不能为空", "岗位不能为空", "请至少选择一种测试类型", "已完成状态请补充完成日期"]), "assessment validation rules missing")
    assert_true('assessmentScope: input.assessmentScope || "海测"' in assessments_js, "new assessments must default to 海测")
    assert_true('input[name="testType"]' in app_js and 'type="checkbox"' in app_js, "assessment test types must use multi-select tags")
    assert_true("receivedAt" not in app_js and "收到时间" not in app_js, "assessment form/table must not request a received date")
    assert_true("monthDayField" in app_js and 'type="datetime-local"' not in app_js, "assessment form must request month/day only")
    assert_true(all(token in assessments_js for token in ["appendSourceMaterials", "applyAssessmentAnalysis", "sourceMaterialIds", '"STALE"']), "new assessment materials must trigger full-set reanalysis state")
    assert_true(all(token in app_js for token in ["renderConciseAssessmentSummary", "renderAssessmentDetail", "原始资料来源", "信息冲突 / 待确认"]), "assessment table/detail separation UI missing")
    assert_true("item.summary" not in app_js and "item.preparationFocus" not in app_js, "assessment table must never fall back to raw legacy text")
    assert_true("sourceMaterialText" in app_js and "不会直接显示为测试重点" in app_js, "manual assessment material must be labeled as raw evidence")
    assert_true(all(token in master for token in ["sourceMaterials", "assessmentSummary.conciseBullets", "信息不一致/待确认", "Never place raw source text directly"]), "durable assessment analysis separation rules missing")
    assert_true("assessmentUpcomingEvents" in app_js and "assessmentPendingActions" in app_js, "assessment deadlines must link to Home")
    assert_true(all(token in css for token in [".assessment-grid", ".assessment-modal", ".assessment-detail-row", ".source-material", ".assessment-focus-list"]), "responsive assessment tracker/detail styles missing")
    assert_true("campus-os-interview-drafts-v1" in interviews_js and 'sourceOfTruth: "local-draft"' in interviews_js, "interview drafts must stay visibly local")
    assert_true("buildInterviewWorkbook" in interviews_js and '"Interviews"' in interviews_js and "interview-tracker.xlsx" in interviews_js, "Excel interview export missing")
    assert_true("campus-os-pipeline-drafts-v1" in pipeline_js and 'sourceOfTruth: "local-draft"' in pipeline_js, "pipeline drafts must stay visibly local")
    assert_true("buildPipelineWorkbook" in pipeline_js and '"流程"' in pipeline_js and '"测评"' in pipeline_js and "pipeline-assessment-tracker.xlsx" in pipeline_js, "two-sheet pipeline Excel export missing")
    assert_true(all(token in app_js for token in ["data-interview-new", "data-interview-export", "新建面试", "Local Draft"]), "interview create/export UI missing")
    assert_true('"/app/interviews.js"' in sw, "service worker shell must include interview module")
    assert_true('"/app/pipeline.js"' in sw, "service worker shell must include pipeline module")

    seed_daily = load_json("data/daily/2026-08-23_seed.json")
    assert_true(seed_daily.get("runType") == "SEED_TEST_RUN", "seed run type missing")
    assert_true(seed_daily.get("classificationCounts") == {"APPLY_NOW": 3, "OPEN": 1, "WATCH": 2, "UPCOMING": 1, "HISTORICAL": 1, "VERIFY": 5}, "seed classification counts drifted")
    assert_true(seed_daily.get("targetCompanyCheckedCount") == 25, "target company baseline must include 25 companies")
    watchlist = load_json("data/target-company-watchlist.json")
    assert_true(watchlist.get("count") == 25 and len(watchlist.get("companies", [])) == 25, "target watchlist count mismatch")
    inbox_seed = load_json("data/inbox/2026-08-23_seed-test-run-request.json")
    assert_true(inbox_seed.get("processed") is True and inbox_seed.get("processedByRun"), "seed request must be marked processed")

    version_api = (ROOT / "api" / "version.js").read_text(encoding="utf-8")
    assert_true("VERCEL_GIT_COMMIT_SHA" in version_api and "no-store" in version_api, "deployment version endpoint must expose uncached commit SHA")

    print("regression_v2: all checks passed")


if __name__ == "__main__":
    main()
