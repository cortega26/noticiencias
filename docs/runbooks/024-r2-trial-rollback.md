# Runbook 024 — R2 image-delivery trial (env-gated) + rollback

Scope: trial `r2` mode without flipping the committed default.
`data/image-delivery-mode.json` stays `github` throughout this spike.

## Trial config (env-gated, existing mechanism — no new config files)

- Trial switch uses the existing `.github/workflows/image-delivery-quota.yml`
  `workflow_dispatch` input (`mode: r2`): it evaluates quota via
  `scripts/r2-image-quota-guard.js` and opens a mode-change PR on
  `automation/image-delivery-mode` for human review. No direct push to `main`.
- Gating names only (types: CI secrets / env; values never in repo):
  `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_ACCOUNT_ANALYTICS_READ_TOKEN` (quota guard);
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL` (publisher uploads);
  `IMAGE_DERIVATIVES_REQUIRE_URL` (strict published-URL enforcement).
  See `.env.example` for the full template.
- Trial scope: preview/staging deploy of the mode-PR branch only; compare
  placeholder rate (`npm run check:hero-images`) and manifest freshness
  (`npm run check:image-derivatives`) against the baseline below.

## Rollback (one page)

1. Re-run `.github/workflows/image-delivery-quota.yml` with
   `workflow_dispatch` input `mode: github`, or revert the mode PR.
2. Run `npm run publish:image-derivatives` to refresh
   `data/image-derivatives-manifest.json`.
3. Verify: `npm run check:hero-images`,
   `npm run check:published-sidecars`, `npm run check:image-derivatives`
   all exit 0; spot-check `og:image` on one article page.
4. Close/abandon the `automation/image-delivery-mode` branch if still open.

## Cost + credential-ops notes

- Cost signal: Class-B request usage vs free-tier limit and warn/switch
  ratios in `scripts/utils/r2-image-quota.js`; each guard run writes a JSON
  summary (status, current/target mode, usage window). Untracked or rising
  cost → keep `github`.
- Credentials are GitHub Secrets / environment only; publisher requires both
  `r2` mode AND the R2 variables (credentials alone never switch delivery —
  see `src/utils/image-delivery-mode.js`).

## Metrics

Baseline (`github`, 2026-09-07, frontend `790ce62`): 33 post files, 0 hero
errors, allowlist 1/33 entries (`src/content/posts/2026-02-12-bienvenidos.md`,
~3.0% placeholder, editorially allowlisted), derivative manifest 33/33
entries with variants (100%), mode `github`, all three checks green.

Trial (`r2`): DEFERRED — (1) no R2 credentials provisioned this session
(credential values are never read or handled by the spike); (2) no deploy
authority (spike forbids pushes/PRs; collector live processes off-limits).
Nothing was faked; no default flip. Decision: keep `github` until an
operator runs the trial above and records metrics here.
