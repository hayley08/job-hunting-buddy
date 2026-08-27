from __future__ import annotations

import argparse
import json

from job_agent.adapters.single_url import JobImportError, SingleUrlAdapter
from job_agent.pipeline import normalize_job
from job_agent.storage import mark_job_applied, save_single_url_import


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import one job detail URL into the existing Campus Job Search OS V2 stores."
    )
    parser.add_argument("url", help="Exact job detail URL supplied by the user")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and normalize without writing repository data")
    parser.add_argument("--applied-date", help="After import, move the job into applications as Applied (YYYY-MM-DD)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        jobs = SingleUrlAdapter(args.url).search()
        if len(jobs) != 1:
            raise JobImportError(f"单岗位 URL 应返回 1 条记录，实际返回 {len(jobs)} 条")
        job = normalize_job(jobs[0])
        if args.dry_run:
            print(json.dumps({"status": "success", "dryRun": True, "job": job.as_dashboard_dict()}, ensure_ascii=False, indent=2))
            return 0
        result = save_single_url_import(job, args.url)
        output = result.as_dict()
        if args.applied_date:
            application = mark_job_applied(result.job_id, args.applied_date, args.url)
            output["application"] = {
                "currentStatus": application["currentStatus"],
                "appliedDate": application["appliedDate"],
            }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except (JobImportError, ValueError) as error:
        print(json.dumps({"status": "failed", "reason": str(error), "url": args.url}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
