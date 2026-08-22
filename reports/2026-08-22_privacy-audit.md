# 2026-08-22 Privacy / Secret Audit

## Scope

Audited files selected for migration into the public repository `hayley08/job-hunting-buddy`.

## Findings

- No real API keys, cookies, access tokens, refresh tokens, client secrets, private keys, or Gmail/Feishu credential files were found in the migration set.
- Personal contact details appeared in resume data and legacy dashboard HTML.
- Legacy dashboard text mentioned Gmail and Feishu token status. This is operational context, not a credential, but it was treated as sensitive local integration detail for the public repository.

## Actions

- Personal email addresses were replaced with `hayley@example.com`.
- Personal phone number was replaced with `[redacted-phone]`.
- Local connector state, logs, one-off Feishu payloads, `.agents`, `.codex`, `.codex-tmp`, and credential/cache patterns were excluded by `.gitignore`.

## Intentionally Excluded

- `.agents/`
- `.codex/`
- `.codex-tmp/`
- `logs/`
- `outputs/`
- `lark_payloads*/`
- one-off root `base-*.json`, `lark-record-*.json`, and Feishu payload JSON files
- local connector artifacts and credential/cache files

## Result

Migration set is suitable for a public repository after redaction.
