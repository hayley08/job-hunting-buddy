from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime

from adapters.boss import BossAdapter
from adapters.jobsdb import JobsDBAdapter
from adapters.linkedin import LinkedInAdapter
from job_agent.pipeline import run_recommendation_pipeline
from job_agent.storage import append_dashboard_jobs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Hayley HR Job Agent daily search.")
    parser.add_argument(
        "--write",
        type=Path,
        default=None,
        help="Optional JSON path to update, for example data/jobs.json.",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Allow writing an empty result set. By default, empty searches do not overwrite existing data.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    adapters = [LinkedInAdapter(), JobsDBAdapter(), BossAdapter()]
    existing_jobs = []
    if args.write and args.write.exists():
        existing_jobs = json.loads(args.write.read_text(encoding="utf-8"))
    result = run_recommendation_pipeline(adapters, existing_jobs=existing_jobs)
    payload = [job.as_dashboard_dict() for job in result.jobs]
    output = json.dumps(payload, ensure_ascii=False, indent=2)
    print(output)

    logs_dir = Path("logs")
    logs_dir.mkdir(parents=True, exist_ok=True)
    report_path = logs_dir / f"quality_report_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.json"
    report_path.write_text(json.dumps(result.report.as_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote quality report to {report_path}.")

    if args.write:
        if not payload and not args.allow_empty:
            print(f"Skip writing {args.write}: no qualified jobs returned.")
            return
        append_dashboard_jobs(args.write, result.jobs, existing_jobs)
        print(f"Wrote {len(existing_jobs) + len(payload)} total jobs to {args.write}.")


if __name__ == "__main__":
    main()
