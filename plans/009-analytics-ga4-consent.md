# Plan 009: GA4 with Consent Mode v2, plus the Cloudflare baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6bd8a2e..HEAD -- src/config.yaml src/components/template/common/Analytics.astro src/components/template/common/CommonMeta.astro src/integration/utils/configBuilder.ts src/types/config.ts src/layouts/template/Layout.astro src/pages/privacidad.md src/pages/transparencia.md tests/config-builder.test.ts tests/compliance.test.ts`
> Phase 0 of this plan already touched several of these. If anything else
> changed, compare against the live code before proceeding; on an unexplained
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (the site cannot evaluate monetization without measurement)
- **Effort**: M
- **Risk**: CRITICAL by the `AGENTS.md` §9 change matrix — it touches
  `src/config.yaml` (config change) plus shared layout and metadata.
- **Depends on**: ADR-0012 `Accepted` (2026-09-18). Supersedes part of
  ADR-0011; plan 007 built the Cloudflare half and stays valid.
- **Category**: Measurement / growth instrumentation
- **Planned at**: 2026-09-18

## Why this matters

The site flies blind, and not because of one switch:

- `src/config.yaml:74` GA id `null`, `src/config.yaml:80` Cloudflare token
  `null` — `Analytics.astro` renders neither branch.
- `src/config.yaml:13` `googleSiteVerificationId: ''` — Search Console is not
  verified, so there is no search or Discover data either. Discover is the
  realistic traffic channel for a zero-authority site.
- The GA branch was **broken, not just disabled**: `partytown: true` was the
  config default while `@astrojs/partytown` is not installed, so both GA
  scripts carried an unknown `text/partytown` MIME type that no browser
  executes. A valid `G-` ID would have yielded zero data and zero errors.

ADR-0012 reverses ADR-0011's exclusion of GA4 because that evaluation weighed
the cost of collecting pageviews but not the value of what is collected, and
the operator needs events, conversions and cohorts to evaluate monetization.

## Scope

**In**: the Partytown fix; CSP sync + a test that keeps its three copies
aligned; ADR-0012; Search Console verification; a consent module, a banner and
Consent Mode v2 signals; the GA4 CSP delta; enablement; the first events.

**Out**: Google Signals / ads personalization (ADR-0012 keeps it off); moving
CSP emission into the Worker (deferred, recorded in ADR-0012 Q3); dashboard
surfacing of metrics (still deferred from plan 007).

## Git workflow

Branch `advisor/009-analytics-ga4-consent`, conventional commits, one commit
per phase. Do not push without being told to.

## Steps

### Phase 0 — Unblocked work (DONE 2026-09-18)

- **Step 0.1 — Search Console.** Set `googleSiteVerificationId` in
  `src/config.yaml:13`. `SiteVerification.astro` is already mounted at
  `Layout.astro:75` and emits the meta as soon as the value is non-empty; no
  code to write. **BLOCKED on the operator supplying the value.**
  **Verify**: after deploy, `curl -s https://noticiencias.com/ | grep google-site-verification`.
- **Step 0.2 — Partytown fix (DONE).** Removed the `partytown` default from
  `configBuilder.ts`, the field from `AnalyticsConfig` in `src/types/config.ts`,
  and the `type="text/partytown"` attributes from `Analytics.astro`. Inverted
  the two assertions in `tests/config-builder.test.ts` and added a regression
  test that the flag does not come back.
  **Verify**: `npx vitest run tests/config-builder.test.ts`.
- **Step 0.3 — CSP sync (DONE).** `public/_headers` and
  `docs/DEPLOYMENT_SECURITY_HEADERS.md` had drifted from the enforcing meta tag
  (both missing `static.cloudflareinsights.com` and `buttondown.com`) with
  nothing to catch it. Synced all three and added a test in
  `tests/compliance.test.ts` that extracts the policy from `CommonMeta.astro` —
  the source of truth, since GitHub Pages cannot emit headers — and asserts the
  other two contain it verbatim.
  **Verify**: `npx vitest run tests/compliance.test.ts`.
- **Step 0.4 — ADR-0012 (DONE).** `docs/adr/0012-ga4-consent-mode.md`, with
  ADR-0011's status updated to superseded-in-part.

### Phase 1 — Consent infrastructure (ships disabled) (DONE 2026-09-18)

Same posture as plan 007: additive code that changes nothing visible while the
GA id stays `null`.

- **Step 1.1 — Consent module.** `src/utils/browser/consent.ts`, alongside the
  existing `search-index.ts` / `search-url.ts`. Reads, writes and broadcasts
  the consent decision in `localStorage`. It lives there because LAW-F3:118
  forbids `localStorage` in Astro frontmatter or shared server code, and it
  stays specific rather than becoming a generic storage helper — `AGENTS.md` §4
  names that anti-pattern directly. Persist policy version, decision and
  timestamp, so a change of purposes can re-ask.
  **Verify**: unit tests for the module; `npm run test:coverage`.
- **Step 1.2 — Consent Mode signals in `Analytics.astro`.** In order, before
  `gtag.js` loads: define `dataLayer`; `gtag('consent', 'default', ...)` with
  `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization` all
  `denied`; then `gtag('consent', 'update', ...)` if a
  stored decision exists; only then `gtag.js` and `gtag('config', id)`.
  Ordering is load-bearing — a `default` after `config` leaves a window in
  which `_ga` was already written. **Deviation:** no `wait_for_update`. That
  parameter is for a consent update that arrives asynchronously (a CMP loading
  late); here the stored decision is read from `localStorage` and applied
  synchronously in the same script, before `config`, so there is nothing to
  wait for. The script is built by `buildConsentBootstrap()` in
  `src/utils/browser/consent.ts` and `tests/consent.test.ts` executes it against
  a fake `window` to assert the dataLayer order.
- **Step 1.3 — Banner.** A component in the **`ds/` layer**, mounted in
  `Layout.astro` near `<Analytics />` (line 76). It must not go under
  `src/components/template/common/`: `scripts/freeze-template.js` gates that
  directory with a path allowlist, and a new file there fails
  `npm run check:freeze` (part of `validate:content`). `Analytics.astro` and
  `CommonMeta.astro` are already on that allowlist, so editing them is fine.
  `ds/` is also the correct layer by LAW-F2 — this is project-owned UI, and
  `template` may import `ds` but not the reverse. Static HTML plus a scoped inline script, no island
  (LAW-F3:117). **Idempotent across `ClientRouter` page transitions**
  (`Layout.astro:79`, LAW-F3:120) — do not double-bind listeners on swap, and
  re-read stored consent afterwards. Accept and reject get equal visual weight.
  No layout shift (LAW-F8). A footer link reopens the choice.
  **Verify**: `tests/playwright/lifecycle.test.ts` for transition idempotency.
- **Step 1.4 — GA4 CSP delta.** In `CommonMeta.astro`, `connect-src` gains
  `https://*.google-analytics.com` and `https://*.analytics.google.com`. GA4
  shards endpoints by region and the wildcards do **not** implicitly cover the
  bare or `www.` host, so keep the existing entry. Mirror into `public/_headers`
  and `docs/DEPLOYMENT_SECURITY_HEADERS.md` — the step-0.3 test enforces this.
- **Step 1.5 — Testing the enabled branch.** `src/config.yaml` ships with
  `id: null`, there is no `.astro` render harness in vitest, and Playwright
  builds from the committed config — so without an override every consent test
  would assert "nothing rendered". Add an environment-variable override (`NOTICIENCIAS_GA_ID`) for the
  GA id in `getAnalytics` (`configBuilder.ts`), and a dedicated Playwright
  config (`playwright.consent.config.ts`) that builds with it set into
  `dist-consent/` and serves it with `scripts/serve-static.mjs` (`astro preview`
  daemonizes and always serves `dist/`). Run with `npm run test:e2e:consent`; it
  is wired into `content-guard.yml` and `verify:ci`. The override doubles as a way to enable GA4
  from a CI secret instead of committing the id.
- **Step 1.6 — Tests.** Extend `tests/config-builder.test.ts` for the override;
  `tests/playwright-consent/consent.test.ts` asserting consent starts denied
  before `config`, accept/reject parity, that an accept sends exactly one update,
  that the choice survives a reload, that the footer link reopens the banner, and
  that `ClientRouter` navigations neither hide the banner nor duplicate the click
  listener. **Deviation:** gtag.js is stubbed so the suite is hermetic, which
  means it asserts what the page _asks_ Google to do (the dataLayer), not that
  `_ga` is absent. **The `_ga`-cookie check therefore stays a post-deploy manual
  check** (see Done criteria). The duplicated-listener test was mutation-checked:
  binding a fresh anonymous handler on every `astro:page-load` makes it fail; a
  `scripts/dist-sanity.js` assertion that `gtag/js` is absent from `dist/`
  while the id is null (not `googletagmanager`, which the CSP allowlists on
  every page).

### Phase 2 — Enablement (config applied 2026-09-18; post-deploy checks pending)

A small separate PR: the only one that changes visible behaviour and public
promises.

- `src/config.yaml`: the `G-` id and the Cloudflare token.
- **`src/pages/transparencia.md:23`** commits to "Solo usamos métricas
  agregadas sin PII"; a `_ga` client id is not that. Revise the commitment, and
  flip line 29 from pending to active in the same commit, as plan 007's
  maintenance note requires.
- `src/pages/privacidad.md:53-59`: rewrite — it currently announces Cloudflare
  running without a banner. Must state GA4, advanced Consent Mode, that gtag
  loads before consent, retention, and how to revoke.
  **Verify in production**: a configured token is not proof the script runs.
  Confirm in the browser and in the GA4 realtime report.

### Phase 3 — Events (DONE 2026-09-18, ships with the rest disabled)

All events go through `window.gtag`, which only exists while GA4 is on, so with
the id null every call is a silent no-op. `src/utils/browser/analytics-events.ts`
holds `trackEvent` plus two pure helpers; the interactions use `data-analytics-*`
hooks owned by the components that render them, and one delegated script
(`ds/templates/AnalyticsEvents.astro` → `AnalyticsEventsScript.astro`, gated the
same way as the banner so nothing ships while GA is off).

| Event                   | Hook                                                        | Notes                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `newsletter_signup`     | `data-analytics-newsletter` on the `NewsletterCapture` form | **A submit, not a confirmed subscription** — Buttondown uses double opt-in, so this over-counts. Mark it as a conversion knowing that. Sent with `transport_type: beacon` because the form navigates away. |
| `outbound_source_click` | `data-analytics-source` on `TrustPanel` source links        | Params `link_domain`, `link_url`. Measures the trust layer; basis for any affiliate reasoning.                                                                                                             |
| `scroll_75`             | `data-analytics-scroll` on the article body in `PostLayout` | Once per page; **no check on load**, so a short article that fits the viewport does not count as read.                                                                                                     |
| `search`                | sent from `SearchInterface`                                 | GA4's recommended event name instead of the planned `search_query`, so GA4 reports it natively. Params `search_term`, `results_count`.                                                                     |

**Privacy consequence for phase 2:** `search_term` is free text typed by the
visitor and is sent to Google. `privacidad.md` must say so, and the newsletter
event should be described as a form submit. Nothing else identifying is sent.

Verified by `tests/analytics-events.test.ts` (100% coverage entry) and four e2e
tests in `tests/playwright-consent/`. Two mutants were checked: removing the
newsletter hook, and removing the post-fire `stopScroll` so `scroll_75` repeats;
each fails its test.

**Operator task added:** in GA4, register `newsletter_signup` as a key event, and
create `link_domain` / `search_term` / `results_count` as custom dimensions if you
want them in reports (event parameters are not reportable by default).

## Test plan

Per change-matrix CRITICAL, each phase runs:

```bash
npm run lint && npm run validate:content && npm run build \
  && npm run test:dist && npm run test:audit && CI=1 npm run test:e2e
```

Plus `npm run test:coverage` — `vitest.config.ts` pins `configBuilder.ts` at
statements 100 / branches 93 / functions 100 with `perFile: true`, so every new
branch needs a test in the same commit. Phase 0 left it at 100 / 93.75 / 100 /
100, i.e. barely over the branch floor: the next branch added to that file
needs its test in the same commit or the gate trips. Manual check at 375px and
1280px with no console errors (`AGENTS.md` §7).

**Local e2e caveat**: `CI=1 npm run test:e2e` does not work on a dev machine
here. `astro preview` in this project daemonizes and returns immediately, so
Playwright's `webServer` (with `reuseExistingServer: false` under CI) sees the
process exit early and aborts. Locally, start `npm run preview` first and run
`npm run test:e2e` without `CI=1` — noting that this drops `retries: 2` and
`workers: 2`, so it is not byte-identical to the CI run.

## Done criteria

- [x] No `partytown` reference remains in `src/` (`grep -rn partytown src/` is empty).
- [x] `tests/compliance.test.ts` fails if the CSP drifts between the meta tag, `public/_headers` and `docs/DEPLOYMENT_SECURITY_HEADERS.md`.
- [x] ADR-0012 exists and ADR-0011 records being superseded in part.
- [ ] `googleSiteVerificationId` is set and the property is verified in Search Console.
- [x] With the GA id null, `grep -rl "gtag/js" dist/` and `grep -rl "text/partytown" dist/` are both empty. (Do **not** grep for `googletagmanager` alone — the CSP allowlists that host, so it matches every page.)
- [x] With the id set via `NOTICIENCIAS_GA_ID`, consent starts denied and is queued before `config` (e2e, gtag stubbed).
- [ ] **Post-deploy, real gtag.js:** no `_ga` cookie before accepting, one after (browser devtools).
- [x] The banner does not double-bind across a `ClientRouter` transition (mutation-checked).
- [ ] `privacidad.md` and `transparencia.md` describe what actually runs.

## STOP conditions

- The banner cannot be made idempotent across transitions without a hydrated
  island — that crosses LAW-F3 and needs explicit review.
- Syncing the CSP reveals the live edge header diverging in undocumented ways —
  that is a security finding, not a plan detail.
- Legal wording: the assistant drafts `privacidad.md` / `transparencia.md`, but
  the Ley 19.628 position is the operator's to confirm.

## Maintenance notes

- **Operator checklist**: `docs/ANALYTICS_OPERATOR_CHECKLIST.md` has the ordered steps, the exact `config.yaml` change and the post-deploy verification.
- **Operator tasks** (outside the code): create the GA4 property and get the
  Measurement ID; **raise data retention from the 2-month default to 14 months**
  — not retroactive, so it must happen before traffic accumulates; mark
  `newsletter_signup` as a conversion; link Search Console to GA4; verify the
  GSC property; get the Cloudflare Web Analytics token; update the edge
  Response Header Transform Rule with the new CSP.
- **Banner script is gated on the id (LAW-F8).** Astro hoists a component's own
  `<script>` regardless of a conditional inside its template, which shipped an
  inert ~0.9 KB module on all 216 pages while GA was off. The script therefore
  lives in `ConsentBannerScript.astro`, rendered only from inside the
  `{enabled && ...}` block of `ConsentBanner.astro`; with the id null the built
  `dist/` contains no banner script, element, footer control or gtag.js.
- **Unresolved flake, not attributed** — tracked in
  `docs/backlog/a11y-target-size-flake.md` with the data, three untested
  hypotheses and a reproduction loop. Summary: axe `target-size` on a tag pill
  failed in ~3 of ~13 local runs under machine load, then 0/10 on this branch and
  0/10 on the pre-phase-1 commit; the failing pages carry no phase 1 markup.
- **Enablement findings (2026-09-18).** (1) With the real config, the regular
  e2e suite loaded the live Google/Cloudflare scripts: from `localhost` the
  Cloudflare beacon POST is rejected by CORS (origin is not the registered host)
  and floods the console, and the visible banner covers the footer during axe
  audits. Fixed with `tests/playwright/fixtures.ts`: analytics hosts stubbed and a
  consent choice pre-stored; the visible banner is audited in
  `tests/playwright-consent/`. (2) The beacon reports to
  `https://cloudflareinsights.com/cdn-cgi/rum`, not own-domain `/cdn-cgi/rum`
  as ADR-0011 assumed, so `connect-src` now allows `https://cloudflareinsights.com`.
  (3) The apex is proxied by Cloudflare; only `www` is served directly by GitHub
  Pages (it 301s to the apex). (4) Search Console needs no meta tag: a domain
  property is already verified.
- **Deferred**: the Worker already intercepts all zone HTML
  (`workers/src/index.ts`) and could emit the CSP instead of the manual
  Transform Rule (ADR-0012 Q3). Dashboard surfacing of metrics remains deferred
  from plan 007.
