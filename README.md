# Hayley Campus Job Search OS V2

Personal PWA dashboard and JSON data layer for Mainland China 2027 campus recruitment HR job search.

## Scope

- Active market: Mainland China campus recruitment
- Archived market: Hong Kong historical HR job records
- Stack: static PWA + JSON + GitHub + Vercel
- Daily run: 12:00 Asia/Shanghai

## Main Files

- `MASTER_REQUIREMENTS.md` - product requirements source of truth
- `ARCHITECTURE_V2.md` - technical architecture
- `SKILL.md` - daily run instructions
- `index.html`, `app/`, `manifest.json`, `service-worker.js` - PWA dashboard
- `data/` - structured job-search data
- `reports/` - migration reports and daily briefs
- `tests/` - regression checks

## Privacy

This repository is public. Local secrets, connector state, cookies, tokens, and credentials must not be committed. Public data uses placeholders for personal contact details.

## Feishu Base Sync

The job-management path is now search adapters -> Feishu Base -> generated `data/jobs.json` -> existing dashboard stores. The current static dashboard remains unchanged. The scheduled sync endpoint is `/api/sync-feishu`; setup and required Preview-only environment variables are documented in `reports/2026-08-29_feishu-base-sync.md`.
