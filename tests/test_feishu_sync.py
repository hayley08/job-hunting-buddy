import unittest
from datetime import datetime

from job_agent.feishu_sync import coerce_jobs_json_row, consolidate_jobs, from_feishu_cells, materialize_dashboard_stores, merge_feishu_rows, to_feishu_cells


class FeishuSyncTests(unittest.TestCase):
    def setUp(self):
        self.application = {
            "jobId": "app-1", "company": "A", "title": "HRBP", "location": "上海", "market": "Mainland",
            "currentStatus": "Applied", "appliedDate": "2026-08-20", "statusUpdatedAt": "2026-08-20",
            "statusHistory": [{"status": "Applied", "date": "2026-08-20"}], "manualOverrides": {},
            "applyUrl": "https://example.com/jobs/1", "notes": "old", "archived": False,
        }
        self.opportunity = {
            "jobId": "opp-1", "company": "B", "title": "OD", "location": "北京", "market": "Mainland",
            "currentStatus": "Recommended", "classification": "APPLY_NOW", "recommendationDate": "2026-08-29",
            "recommendationDates": ["2026-08-29"], "firstRecommendedAt": "2026-08-29T12:00:00+08:00",
            "matchReasons": ["OD match"], "risks": [], "matchScore": 9, "applyUrl": "https://example.com/jobs/2",
        }
        self.jd = {"jobId": "opp-1", "jdStatus": "Current JD", "jdRaw": "full JD", "jdSummary": "summary", "jdCoreResponsibilities": [], "jdDistinctiveKeywords": [], "jdUniqueRequirements": [], "jdInterviewSignals": [], "jdMustHave": [], "jdNiceToHave": [], "jdKeyOriginalExcerpt": [], "jdVersions": [], "interviewPackNeedsRefresh": False}

    def test_consolidate_and_cell_round_trip_use_existing_fields(self):
        jobs = consolidate_jobs([self.application], [self.opportunity], [], [self.jd])
        self.assertEqual({job["jobId"] for job in jobs}, {"app-1", "opp-1"})
        cells = to_feishu_cells(next(job for job in jobs if job["jobId"] == "opp-1"))
        self.assertEqual(cells["applyUrl"], "https://example.com/jobs/2")
        self.assertEqual(from_feishu_cells(cells)["matchReasons"], ["OD match"])
        self.assertEqual(from_feishu_cells(cells)["recommendationDate"], "2026-08-29")

    def test_feishu_status_change_moves_job_and_preserves_history(self):
        jobs = consolidate_jobs([self.application], [self.opportunity], [], [self.jd])
        incoming = [{"jobId": "opp-1", "company": "B", "title": "OD", "currentStatus": "Applied", "appliedDate": "2026-08-29", "notes": "submitted"}]
        merged = merge_feishu_rows(jobs, incoming, datetime.fromisoformat("2026-08-29T18:00:00+08:00"))
        baseline = {"applications": [self.application], "opportunities": [self.opportunity], "historical": [], "jds": [self.jd]}
        stores = materialize_dashboard_stores(merged, baseline)
        moved = next(item for item in stores["applications"] if item["jobId"] == "opp-1")
        self.assertEqual(moved["currentStatus"], "Applied")
        self.assertTrue(any(event["status"] == "Applied" for event in moved["statusHistory"]))
        self.assertFalse(any(item["jobId"] == "opp-1" for item in stores["opportunities"]))

    def test_non_job_jd_records_are_preserved(self):
        reminder_jd = {**self.jd, "jobId": "reminder-1", "jdStatus": "JD Missing", "jdRaw": ""}
        jobs = consolidate_jobs([self.application], [self.opportunity], [], [self.jd, reminder_jd])
        baseline = {"applications": [self.application], "opportunities": [self.opportunity], "historical": [], "jds": [self.jd, reminder_jd]}
        stores = materialize_dashboard_stores(jobs, baseline)
        self.assertIn("reminder-1", {item["jobId"] for item in stores["jds"]})

    def test_rejects_link_mismatch_shape_instead_of_silent_corruption(self):
        jobs = consolidate_jobs([], [self.opportunity], [], [self.jd])
        with self.assertRaisesRegex(ValueError, "non-HTTPS"):
            merge_feishu_rows(jobs, [{"jobId": "opp-1", "company": "B", "title": "OD", "applyUrl": "not-a-link"}])

    def test_date_projection_keeps_valid_iso_prefix(self):
        cells = to_feishu_cells({"jobId": "opp-1", "deadline": "2026-12-31（网页显示字段）"})
        self.assertEqual(cells["deadline"], "2026-12-31 00:00:00")

    def test_legacy_search_job_maps_to_existing_v2_fields(self):
        row = coerce_jobs_json_row({
            "jobId": "source-3", "company": "C", "title": "People Ops", "location": "深圳",
            "source": "LinkedIn", "url": "https://example.com/jobs/3", "jobDescription": "raw JD",
            "matchScore": 8, "matchReason": "operations match", "risk": "verify freshness", "activeStatus": "active",
        })
        self.assertEqual(row["applyUrl"], "https://example.com/jobs/3")
        self.assertEqual(row["jdRaw"], "raw JD")
        self.assertEqual(row["classification"], "OPEN")

    def test_markdown_url_readback_is_normalized(self):
        row = from_feishu_cells({"jobId": "opp-1", "applyUrl": "[岗位](https://example.com/jobs/1)"})
        self.assertEqual(row["applyUrl"], "https://example.com/jobs/1")


if __name__ == "__main__":
    unittest.main()
