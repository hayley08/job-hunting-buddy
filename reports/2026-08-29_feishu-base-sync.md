# Feishu Base Sync Implementation

Date: 2026-08-29

## Result

The target Base `秋招面板底表` now uses a projection of the repository's existing job/application/JD fields. The original table contained one generic text field and five empty records; the field was initialized as `jobId`, 38 additional existing-schema fields were created, the five empty placeholders were removed, and 34 current application/opportunity/historical records were imported.

Readback QA:

- Base records: 34
- Unique `jobId`: 34
- Fields: 39
- Xiaopeng title: `【27届校招】HRBP培训生（机器人）`
- Xiaopeng URL: exact official user-provided URL
- Xiaopeng raw JD: present

## Runtime Flow

```text
existing search adapters / repository JSON
-> insert jobs missing from Feishu by jobId
-> Feishu Base user edits
-> POST /api/sync-feishu at 18:00 UTC+8
-> generated data/jobs.json
-> existing applications/opportunities/historical/JD JSON stores
-> current static dashboard
```

The sync performs one Git commit only when generated data changed. That commit targets `feature/campus-job-os-v2`, which triggers the existing Vercel Preview deployment. It never updates or merges `main`.

## Required Vercel Preview Configuration

Set the variables listed in `config/feishu-sync.example.txt` for Preview deployments, with a branch-specific override for `feature/campus-job-os-v2` where available.

- `FEISHU_APP_ID` and `FEISHU_APP_SECRET`: the Feishu app that already has bot access to this Base.
- `GITHUB_SYNC_TOKEN`: a fine-grained token limited to `hayley08/job-hunting-buddy` with repository Contents read/write permission.
- `SYNC_WEBHOOK_SECRET`: a long random value shared only by Vercel and the Feishu workflow.
- Base/table/repository/branch identifiers use the non-secret values in the example file.

Because the stable branch Preview currently has Vercel Deployment Protection, also configure a Protection Bypass for Automation secret. The Feishu HTTP step must send it as `x-vercel-protection-bypass`.

## Feishu 18:00 Workflow

After the feature deployment containing `/api/sync-feishu` is successful and the Preview environment variables are present, create and enable this Base workflow:

1. `TimerTrigger`: DAILY, start at 18:00 Asia/Shanghai, never end.
2. `HTTPClientAction`: POST the stable feature branch URL plus `/api/sync-feishu`.
3. Headers: `Content-Type: application/json`, `x-sync-secret: <SYNC_WEBHOOK_SECRET>`, and, while deployment protection is enabled, `x-vercel-protection-bypass: <automation bypass secret>`.
4. Response type: JSON with `{"ok":true,"changed":true,"recordCount":34}` as the response example.

Do not enable the workflow before the endpoint is deployed and both secret headers are configured.

## Safety

- No credentials are committed.
- Feishu rows are keyed by canonical `jobId`; missing repository jobs are inserted, existing Base rows are not blindly overwritten.
- Base edits are overlaid onto the existing record while unprojected history remains intact.
- Status changes append `statusHistory` and keep `Applied` separate from `Application In Progress`.
- Invalid/non-HTTPS URLs fail the sync instead of being saved.
- Unknown Base columns are ignored; the integration cannot expand the repository schema.
