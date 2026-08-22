import json
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
        "data/daily/latest.json",
        "reports/2026-08-22_daily-brief.md",
    ]
    for path in required_files:
        assert_true((ROOT / path).exists(), f"required file missing: {path}")

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    assert_true("networkFirst" in sw and "/data/" in sw, "service worker must use network-first for JSON data")

    print("regression_v2: all checks passed")


if __name__ == "__main__":
    main()
