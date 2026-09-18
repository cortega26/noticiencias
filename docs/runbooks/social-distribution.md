# Runbook — Social distribution (Buffer MVP + deferred Bluesky)

Status: operational. Buffer pipeline (facebook/x/linkedin) live since
2026-09-14; Bluesky code-ready, credentials deferred (see below).
Plan 112 closed the reconcile-dispatch gap and wrote this page.

## How it flows

1. Deploy to GitHub Pages succeeds on `main` → `social-distribution.yml`
   `publish` job runs `scripts/social/publish.js --execute` (only when
   `vars.SOCIAL_PUBLISH_ENABLED == 'true'`).
2. Publisher reads `/social-manifest.json`, sends once per opted-in
   article/platform (`social: {publish:true}` set at backend stamping),
   polls ACCEPTED states, persists proof, reconciles the `social-state`
   ledger branch. Re-runs never duplicate.
3. Manual `workflow_dispatch` modes: `dry-run` (default, zero mutations),
   `reconcile` (ledger writes, no sends), `publish` (gated like auto).

## Normal operations

- Pre-flight: `node scripts/social/operate.js doctor` (state, Buffer
  org + channels, Bluesky). Non-zero = fix before dispatching.
- Dry check: dispatch the workflow with `mode: dry-run`.
- Settle ACCEPTED states: dispatch with `mode: reconcile`
  (runs `publish.js --execute --reconcile`; writes ledger only).
- Manual conflict (duplicate id, disputed intent):
  `node scripts/social/operate.js resolve-state --social-id <hex64>
--platform <facebook|x|linkedin|bluesky> --intent-id <id>
--expected-revision <n> --action <adopt|block|authorize-retry>
--actor <name> --reason <text> --evidence-file <path>`.
  No `--force-publish` exists by design.

## Kill switch (one page)

1. Set repo variable `SOCIAL_PUBLISH_ENABLED=false`, and/or cancel the
   active `Social Distribution` run (concurrency group
   `social-distribution`, `cancel-in-progress: false` protects history).
2. Limit blast radius with `SOCIAL_PLATFORMS` (subset of channels).
3. Verify: latest run summary shows no new mutations; ledger branch
   `social-state` revision unchanged.

## Bluesky — deferred, not broken (decision record)

Provider code (`scripts/social/providers/bluesky.js`) is implemented and
tested, but no account exists: `BLUESKY_DID` / `BLUESKY_PDS_URL` /
`BLUESKY_APP_PASSWORD` are unset. Activating = set the three vars,
run `doctor`, dispatch `dry-run`, then enable per-platform via
`SOCIAL_PLATFORMS`. No code change needed.

## Names only (values live in CI secrets/vars, never in repo)

Secrets: `BUFFER_API_KEY`, `BLUESKY_APP_PASSWORD`.
Vars: `SOCIAL_PUBLISH_ENABLED`, `SOCIAL_PLATFORMS`,
`SOCIAL_MANIFEST_URL`, `BUFFER_ORGANIZATION_ID`,
`BUFFER_FACEBOOK_CHANNEL_ID`, `BUFFER_X_CHANNEL_ID`,
`BUFFER_LINKEDIN_CHANNEL_ID`, `BLUESKY_DID`, `BLUESKY_PDS_URL`.

## Validation after any change here

`npm run test:audit` (covers `tests/social/`), `npm run check:contract-sync
--strict`, and a `dry-run` dispatch. Never validate with a real publish.
