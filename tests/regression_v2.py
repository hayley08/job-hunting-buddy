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
    archive_data = load_json("data/archive.json")
    archive = archive_data if isinstance(archive_data, list) else archive_data.get("records", [])
    story_bank = load_json("data/story-bank.json")
    reminders = load_json("data/reminders.json")
    jds = load_json("data/jds.json")
    pending = load_json("data/pending.json")
    handoff = load_json("data/handoffs/2026-08-22_handoff.json")

    job_ids = [item.get("jobId") for item in applications + opportunities + archive if item.get("jobId")]
    assert_true(len(job_ids) == len(set(job_ids)), "duplicate jobId detected")

    active_apps = [item for item in applications if item.get("market") == "Mainland" and not item.get("archived")]
    active_opps = [item for item in opportunities if item.get("market") == "Mainland" and not item.get("archived")]
    archived_hk = [item for item in archive if item.get("market") == "HongKong" and item.get("archived") is True]

    assert_true(len(archived_hk) == len(archive), "archive contains non-archived or non-HK record")
    assert_true(all(item.get("market") == "Mainland" for item in active_apps), "non-Mainland active application detected")
    assert_true(all(item.get("market") == "Mainland" for item in active_opps), "non-Mainland active opportunity detected")

    applied_ids = {item.get("jobId") for item in applications if item.get("currentStatus") == "Applied"}
    opportunity_ids = {item.get("jobId") for item in opportunities}
    assert_true(not applied_ids.intersection(opportunity_ids), "applied job appears in opportunities")

    for item in applications:
        if item.get("currentStatus") == "Closed":
            assert_true(item.get("currentStatus") != "Rejected", "Closed counted as Rejected")
        assert_true(isinstance(item.get("statusHistory"), list), f"missing statusHistory: {item.get('jobId')}")

    core = story_bank.get("coreIntroduction", {})
    assert_true(core.get("locked") is True, "core introduction must remain locked")
    assert_true(core.get("introCN60") == "Needs User Input", "core introduction changed unexpectedly")
    assert_true(len(story_bank.get("stories", [])) >= 17, "initial Story Bank scaffold incomplete")

    assert_true(any(item.get("pendingId") == "pending-git-branch" for item in pending), "Git blocker missing from pending queue")
    assert_true(handoff.get("runDate") == "2026-08-22", "handoff missing or wrong date")
    assert_true(len(reminders) == 15, "user-image reminder list should contain 15 entries")
    assert_true(all(item.get("sourceOfTruth") == "user" for item in reminders), "reminders must be explicit user-provided records")
    assert_true(all(item.get("status") == "提醒列表" for item in reminders), "reminders must stay in 提醒列表 status")

    jd_ids = [item.get("jobId") for item in jds]
    assert_true(len(jd_ids) == len(set(jd_ids)), "same job must not duplicate JD records")
    expected_jd_ids = {item.get("jobId") for item in applications if item.get("jobId")}
    expected_jd_ids.update(item.get("reminderId") for item in reminders if item.get("reminderId"))
    assert_true(expected_jd_ids.issubset(set(jd_ids)), "applications and reminders must have JD or JD Missing records")

    complete_jds = [item for item in jds if item.get("jdStatus") != "JD Missing"]
    missing_jds = [item for item in jds if item.get("jdStatus") == "JD Missing"]
    assert_true(len(complete_jds) == 4, "current backfill should include 4 structured JD records")
    assert_true(len(missing_jds) >= 1, "jobs without JD must be marked JD Missing")
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

    required_files = [
        "index.html",
        "app/app.js",
        "app/store.js",
        "app/filters.js",
        "app/styles.css",
        "manifest.json",
        "service-worker.js",
        "vercel.json",
        "MASTER_REQUIREMENTS.md",
        "ARCHITECTURE_V2.md",
        "SKILL.md",
        "memory.md",
        "data/jds.json",
        "data/daily/latest.json",
        "reports/2026-08-22_daily-brief.md",
    ]
    for path in required_files:
        assert_true((ROOT / path).exists(), f"required file missing: {path}")

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    assert_true("networkFirst" in sw and "/data/" in sw, "service worker must use network-first for JSON data")

    app_js = (ROOT / "app" / "app.js").read_text(encoding="utf-8")
    css = (ROOT / "app" / "styles.css").read_text(encoding="utf-8")
    assert_true('label: "Story"' not in app_js, "Story must not be a first-level tab")
    assert_true('label: "面试"' in app_js, "面试 must be the first-level interview tab")
    assert_true("bottom-nav" not in app_js and "bottom-nav" not in css, "bottom navigation must not be restored")
    assert_true("Resume Copy Tool" in app_js and "Story Bank" in app_js, "面试 tab must contain Resume Copy Tool and Story Bank")
    assert_true('label: "提醒列表"' in app_js, "pipeline must expose explicit reminder list filter")
    assert_true('label: "JD"' in app_js and "renderJdKnowledge" in app_js, "流程 tab must contain JD Knowledge sub-tab")
    assert_true("state.companies || []" not in app_js, "pipeline must not auto-generate reminders from target companies")
    assert_true("state.archive?.records" not in app_js, "pipeline must not auto-generate reminders from archive records")
    assert_true(".sidebar" in css and ".mobile-topbar" in css and ".pipeline-grid" in css, "sidebar/mobile/responsive pipeline layout CSS missing")

    print("regression_v2: all checks passed")


if __name__ == "__main__":
    main()
