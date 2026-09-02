import json
import unittest
from email.message import Message
from unittest.mock import patch

from job_agent.adapters.single_url import JobImportError, SingleUrlAdapter
from job_agent.models import Job
from job_agent.pipeline import deduplicate_job, existing_dedupe_keys, normalize_job


URL = "https://example.jobs.feishu.cn/398875/position/7669694331025262911/detail"


class FakeResponse:
    def __init__(self, body: str, url: str) -> None:
        self._body = body.encode("utf-8")
        self._url = url
        self.headers = Message()
        self.headers["Content-Type"] = "application/json; charset=utf-8"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, _limit: int) -> bytes:
        return self._body

    def geturl(self) -> str:
        return self._url


class SingleUrlAdapterTests(unittest.TestCase):
    def test_json_ld_decodes_entity_encoded_html_before_stripping_tags(self):
        html = """
        <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "HR Manager",
          "hiringOrganization": {"name": "P&G"},
          "identifier": {"value": "CNC003210"},
          "description": "&lt;p&gt;Responsibilities:&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Partner with business leaders.&lt;/li&gt;&lt;/ul&gt;"
        }
        </script>
        """
        generic_url = "https://careers.example.com/job/CNC003210/hr-manager"
        with patch("job_agent.adapters.single_url.urlopen", return_value=FakeResponse(html, generic_url)):
            job = SingleUrlAdapter(generic_url).search()[0]

        self.assertEqual(job.jobDescription, "Responsibilities:\nPartner with business leaders.")
        self.assertNotIn("<p>", job.jobDescription)

    def test_feishu_url_maps_to_existing_job_model_and_preserves_url(self):
        html = '<script id="js-websiteInfo" type="text/json">{"tenant_info":{"tenant_name":"小鹏集团"}}</script>'
        api = json.dumps(
            {
                "code": 0,
                "data": {
                    "job_post_detail": {
                        "id": "7669694331025262911",
                        "title": "【27届校招】HRBP培训生（机器人）",
                        "description": "1、负责组织发展、培训和绩效考核。",
                        "requirement": "1、统招本科及以上。",
                        "job_category": {"name": "人力资源", "parent": {"name": "职能 / 支持"}},
                        "recruit_type": {"name": "正式", "parent": {"name": "校招"}},
                        "publish_time": 1785740131165,
                        "channel_online_status": 1,
                        "city_list": [{"name": "深圳"}],
                    }
                },
            },
            ensure_ascii=False,
        )

        def fake_open(request, timeout):
            body = api if "/api/v1/job/posts/" in request.full_url else html
            return FakeResponse(body, request.full_url)

        with patch("job_agent.adapters.single_url.urlopen", side_effect=fake_open):
            job = SingleUrlAdapter(URL).search()[0]

        self.assertEqual(job.title, "【27届校招】HRBP培训生（机器人）")
        self.assertEqual(job.company, "小鹏集团")
        self.assertEqual(job.location, "深圳")
        self.assertEqual(job.url, URL)
        self.assertEqual(job.canonicalUrl, URL)
        self.assertIn("职位描述", job.jobDescription)
        self.assertIn("统招本科及以上", job.jobDescription)
        self.assertEqual(job.jobId, "7669694331025262911")

    def test_failed_page_returns_reason_instead_of_inventing_data(self):
        with patch("job_agent.adapters.single_url.urlopen", return_value=FakeResponse("<html></html>", URL)):
            with self.assertRaisesRegex(JobImportError, "岗位详情接口"):
                SingleUrlAdapter(URL).search()

    def test_meituan_official_api_maps_full_jd_and_preserves_url(self):
        url = "https://zhaopin.meituan.com/web/position/detail?jobUnionId=4694828828&jobShareType=1&highlightType=campus"
        api = json.dumps(
            {
                "status": 1,
                "data": {
                    "jobUnionId": "4694828828",
                    "name": "AI组织转型",
                    "projectName": "2026年（2027届）秋季校招",
                    "jobStatus": "000",
                    "jobFamilyGroup": "人力资源",
                    "cityList": [{"name": "北京市"}, {"name": "上海市"}],
                    "department": [{"name": "人力资源平台"}],
                    "jobDuty": "负责AI与组织的战略研究和方案设计。",
                    "jobRequirement": "专业不限，具备跨领域思维。",
                    "firstPostTime": 1786960994000,
                },
            },
            ensure_ascii=False,
        )

        def fake_open(request, timeout):
            body = api if "/api/official/job/getJobDetail" in request.full_url else "<html></html>"
            return FakeResponse(body, request.full_url)

        with patch("job_agent.adapters.single_url.urlopen", side_effect=fake_open):
            job = SingleUrlAdapter(url).search()[0]

        self.assertEqual(job.title, "AI组织转型")
        self.assertEqual(job.company, "美团")
        self.assertEqual(job.location, "北京市/上海市")
        self.assertEqual(job.url, url)
        self.assertIn("战略研究", job.jobDescription)
        self.assertIn("跨领域思维", job.jobDescription)

    def test_existing_dedup_matches_canonical_url_even_when_ids_differ(self):
        incoming = normalize_job(
            Job(
                title="HRBP培训生",
                company="小鹏集团",
                location="深圳",
                source="example.jobs.feishu.cn",
                salary="未披露",
                experience="2027届",
                url=URL,
                foundDate="2026-08-26",
                jobDescription="JD",
                companySize="",
                industry="汽车",
                jobId="new-id",
                canonicalUrl=URL,
            )
        )
        existing = existing_dedupe_keys(
            [
                {
                    "jobId": "opp-existing",
                    "sourceJobId": "old-id",
                    "title": "HRBP培训生",
                    "company": "小鹏集团",
                    "location": "深圳",
                    "source": "小鹏集团官方招聘",
                    "sourceUrl": URL,
                }
            ]
        )
        self.assertFalse(deduplicate_job(incoming, set(), existing))

    def test_query_identity_keeps_distinct_meituan_jobs_separate(self):
        def make_job(job_id):
            url = f"https://zhaopin.meituan.com/web/position/detail?jobUnionId={job_id}&jobShareType=1"
            return normalize_job(Job(f"岗位{job_id}", "美团", "北京", "zhaopin.meituan.com", "", "", url, "2026-08-27", "JD", "", "", job_id, url))

        seen = set()
        self.assertTrue(deduplicate_job(make_job("1"), seen, set()))
        self.assertTrue(deduplicate_job(make_job("2"), seen, set()))


if __name__ == "__main__":
    unittest.main()
