# Spike 024 — Exit criteria: retire legacy refinery admin + hero-image delivery

Date: 2026-09-07. Spike branch (frontend): `advisor/024-admin-images`.
Frontend HEAD: `790ce62`. Collector HEAD: `e97b615` (read-only this spike;
collector stays on `advisor/012a-collector-hygiene`, zero changes there).

## Step 0 — Citation re-confirmation (all re-checked this session)

| Claim                                                                                                                         | Evidence                                                                                                                                                                                                                                                          | Holds                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Collector dual-admin: `apps/admin/` current (Astro) vs `apps/refinery/` legacy Streamlit fallback until Astro proven flawless | `../noticiencias_news_collector/README.md` lines 31-32; `../noticiencias_news_collector/AGENTS.md` line 60                                                                                                                                                        | Yes, verbatim                                                                    |
| Frontend "Image Derivatives" section; committed mode `github`; credentials alone don't switch                                 | `README.md` lines 55-60; `AGENTS.md` line 74; `data/image-delivery-mode.json` (`{"mode": "github"}`)                                                                                                                                                              | Yes (mode value on file line 2; plan cited line 1 — off-by-one, substance holds) |
| Allowlist sync: `sync:hero-placeholders`, allowlist path, stale-entry guidance                                                | `scripts/utils/hero-placeholders.js` line 21 (`allowlistPath`); `scripts/utils/published-content-sidecars.js` line 81; `scripts/sync-hero-placeholders.js`; `data/hero-image-placeholder-allowlist.json` (1 entry: `src/content/posts/2026-02-12-bienvenidos.md`) | Yes                                                                              |
| Backlog allowlist state                                                                                                       | `article_images_backlog.md` line 21 (only `2026-02-12-bienvenidos.md` on allowlisted `default.png`)                                                                                                                                                               | Yes in substance (line 21 is the status note, not the sync command itself)       |
| Missing derivatives need `publish:image-derivatives`; delivery selection via mode file                                        | `scripts/check-image-derivatives.js` lines 21-32 (missing/stale entry errors); `src/utils/image-delivery-mode.js` (`shouldUsePublishedDerivativeUrls` returns true only for `r2`)                                                                                 | Yes                                                                              |

No citation deltas material to the plan. No STOP.

## Sign-off state: ABSENT → removal BLOCKED by default

Searched in-repo docs/notes only (never solicited): collector `docs/`,
`context/`, `plans/`, `AGENTS.md`, `README.md` for flawless-confirmation /
operator sign-off of Astro-admin daily use. Only hits are the standing
"kept until confirmed flawless" fallback statements themselves
(`../noticiencias_news_collector/README.md`,
`../noticiencias_news_collector/AGENTS.md`) plus unrelated operator
confirmations (corpus labeling, production answers). No recorded operator
sign-off of Astro-admin flawlessness exists. Per plan: proceed Steps 1-2
only; Step 3 is BLOCKED.

## Exit list (operator acceptance — all UNMET at spike time)

- [ ] Daily publish: a full collection→enrichment→PR→merge→deploy day run
      using only the Astro admin (`apps/admin/`), zero Streamlit fallback use.
- [ ] Correction flow: a published-article correction issued and verified live
      from the Astro admin alone.
- [ ] Image attach: a new hero image attached/published end-to-end
      (`npm run publish:image-derivatives` manifest refresh, no placeholder
      regression in `npm run check:hero-images`).
- [ ] Rollback flow: delivery-mode rollback rehearsed per
      `docs/runbooks/024-r2-trial-rollback.md` (flag back to `github` +
      republish) with green `npm run check:image-derivatives`.
- [ ] Operator records flawlessness sign-off in-repo (only then may Step 3
      removal be scheduled).

## Step 3 — REFINERY REMOVAL: BLOCKED

Reasons: (1) no Step-0 sign-off (see above); (2) R2 trial DEFERRED, no green
trial (see `docs/runbooks/024-r2-trial-rollback.md`). Zero deletions made;
`apps/refinery/` untouched. Resurrection pointer (fallback intact at):
collector `e97b615`, frontend `790ce62`.

## Done-criteria mapping

- Exit criteria defined + sign-off state recorded: this file.
- CI automation both-directions proven: `.github/workflows/hero-image-delivery.yml`
  (live fail→pass proofs in spike report).
- R2 trial measured OR deferred with reasons: deferred, see runbook.
- Refinery retired OR blocked-with-evidence: BLOCKED, see above.
