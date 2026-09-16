# ADR-0011: Traffic analytics via Cloudflare Web Analytics (spike — tracking stays off)

- **Date**: 2026-09-15
- **Status**: Accepted (operator 2026-09-16; tracking stays off until a token is configured + legal Q2 clears)

## Context

The site flies blind. Homepage curation, the 150 KB search-artifact budget,
and the cost of the Cloudflare Worker catch-all route (`noticiencias.com/*`,
ADR-0008) are decided without traffic signal, and the promised periodic
growth reports (`transparencia.md:27`, "cuando estén disponibles") cannot
exist.

Analytics is currently off and this ADR keeps it off:

- `src/config.yaml:71-74`: `analytics.vendors.googleAnalytics.id: null`.
- `src/components/template/common/Analytics.astro:4-5` renders nothing
  without a `G-` ID
  (`const isEnabled = gaId && ... String(gaId).startsWith('G-')`).
- Config plumbing (`src/integration/utils/configBuilder.ts:128-135`) merges
  `config.analytics` over defaults (Partytown on by default).
- CSP (`src/components/template/common/CommonMeta.astro:9-12`) pre-allowlists
  `googletagmanager.com` / `google-analytics.com`; any non-Google vendor
  means editing exactly this header.
- Constraints: `transparencia.md:23` aggregate-only metrics without PII;
  `privacidad.md:47-57` Uso data + cookie/tracking-technology disclosure
  (Country: Chile).
- LAW-F8 (AGENTS.md): any vendor script's weight vs Core Web Vitals must be
  scored.

ADR-0008 deferred its Worker-headroom call until analytics are wired, and
this spike must answer whether pageview analytics can even settle it:

> Free plan's 100,000 Worker-invocations/day budget, realistic amplification
> on the order of ~5-15 requests per pageview — headroom in the thousands of
> pageviews/day. **Revisit only if real traffic data (once GA4/GSC are wired
> up) shows this materially matters.** (ADR-0008, Design §3)

## Evaluation (3 vendors × 6 criteria, public docs only)

| Criterion                                                                         | GA4 (`gtag.js`)                                                                                                                                                                                      | Plausible (Cloud)                                                                                                                                                             | Cloudflare Web Analytics (beacon)                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) PII posture vs `transparencia.md:23` (aggregate-only, no PII)                 | Collects IP, device/browser data, `_ga` client IDs — personal data under GDPR-style regimes; multiple EU DPAs ruled standard setups non-compliant. Fits only with Consent Mode v2 + hardened config. | Aggregate-only by design: no cookies, no persistent IDs, daily-rotated random string; no cross-site/day/device linkage. Fits as-is.                                           | No cookies/localStorage, no fingerprinting via IP/UA, no personal data collected (per Web Analytics docs). Fits as-is.                                                                                                                                                                                                                                                                                   |
| (2) Consent banner (Chile; `privacidad.md:53-57` already discloses tracking tech) | Banner required: first-party `_ga` storage fires before consent otherwise (ePrivacy storage rule); Consent Mode v2 mandatory. Decline rates of 30–75% leave large blind spots / modeled data.        | No banner needed for core analytics (no cookies, no personal data).                                                                                                           | No banner needed (no client-side state).                                                                                                                                                                                                                                                                                                                                                                 |
| (3) Script weight / loading vs LAW-F8                                             | ~135 KB gzipped `gtag.js` alone; GTM + consent platform typically push real deployments past ~285 KB. Heaviest; works against the 150 KB search-budget culture and CWV.                              | ~2.5 KB gzipped single script, deferrable. Negligible CWV impact.                                                                                                             | ~30 KB identity as served (`content-length: 30294` on `beacon.min.js`, measured 2026-09-15; compressed over-wire transfer smaller — confirm live transfer size at build), `type="module"` deferred RUM script. Small cost, not zero; also reports Core Web Vitals itself.                                                                                                                                |
| (4) Exact `CommonMeta.astro:11` CSP delta                                         | None — Google hosts already allowlisted.                                                                                                                                                             | `script-src` += `https://plausible.io`; `connect-src` += `https://plausible.io` (events POST to the API endpoint).                                                            | `script-src` += `https://static.cloudflareinsights.com`; `connect-src` += `https://cloudflareinsights.com` — unless the proxied own-domain `/cdn-cgi/rum` endpoint is used, in which case `connect-src` stays `'self'`.                                                                                                                                                                                  |
| (5) Cost at site scale + retention                                                | Free. Event-level retention 2 months default, 14 months max; raw export requires BigQuery.                                                                                                           | Paid from ~$9/mo, tiered by pageviews+events; 30-day trial. Retention per plan (extended on Enterprise). Real cost at ~zero current traffic, but the only option with a bill. | Free on all plans, no per-pageview billing; aggregated (ABR) retention governed by Cloudflare. Trivially fits site scale.                                                                                                                                                                                                                                                                                |
| (6) Answers ADR-0008's per-path Worker-headroom question?                         | **No.** Client pageview beacons cannot count Worker invocations per path (static assets, `/llm-md/*` internal fetches, bots, non-JS clients are invisible to them).                                  | **No** — same pageview-only limitation as GA4.                                                                                                                                | **No** — the beacon alone is equally pageview-only. Co-location convenience only: per-route Worker invocation telemetry already exists vendor-independently (`workers/wrangler.toml:19-21`, `[observability] enabled = true, head_sampling_rate = 1`), so any pageview vendor leaves it intact; Cloudflare only keeps pageviews and Worker telemetry in the same vendor/account with no second pipeline. |

Umami was considered only as a substitute for Plausible, with this stated
reason: same cookieless posture and open-source, but self-hosting it adds
server infrastructure this static site deliberately avoids — so it loses to
both Plausible (no ops) and Cloudflare (no ops, no bill) and is not
evaluated further.

## Decision

Choose **Cloudflare Web Analytics (beacon snippet)** as the site's traffic
metrics vendor when the operator decides to switch analytics on.

Why it wins: it is the only option that is simultaneously free, cookieless
(no banner, fits `transparencia.md:23` as-is), small under LAW-F8 (~30 KB
identity as served, compressed transfer smaller — confirm live transfer size
at build — vs ~2.5 KB gz Plausible and ~135 KB gz `gtag.js`), and a
zero-new-processor choice (Cloudflare already fronts the zone and runs the
`/api/*` Worker). Criterion (6) does not decide: all three beacons are
equally pageview-only, and Worker-headroom telemetry already exists
vendor-independently (`workers/wrangler.toml:19-21`); Cloudflare's edge
there is co-location convenience only (same vendor/account, no second
pipeline). The pick stands on cost + privacy + weight, not on criterion 6.

This ADR enables nothing. No snippet, no account wiring, no token, no
`src/` change ships with it. Analytics stays off until a follow-up change
lands the integration sketch below behind an explicit enable flag.

## Consequences

Easier: no consent-banner build or CMP bundle; no DPA negotiation with a new
vendor; small-cost instrumentation that also reports CWV; Worker-headroom
reviewable in the same dashboard as pageviews; free at any plausible traffic
scale for this site.

Harder / constrained: no native Google Search Console query integration
(Plausible has one — GSC stays a separate manual source, see sketch);
Cloudflare dashboard lives outside the repo (reports can't be versioned,
exports are manual until scripted); the beacon is blocked by some
ad-blockers (edge analytics is the backstop, and only for proxied traffic);
single-vendor concentration on Cloudflare deepens; per-path Worker counts
come from Workers Observability, not from Web Analytics itself — two views
to check, not one.

## Alternatives considered

| Option                                        | Reason rejected                                                                                                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GA4 (`gtag.js`, zero CSP delta)               | Heaviest script (~135 KB + GTM/CMP), mandatory consent banner with large data gaps, PII posture conflicts with `transparencia.md:23` without hardening; pageview-only, so it cannot answer ADR-0008 either. Incumbent plumbing is not a reason to accept all of that. |
| Plausible Cloud                               | Strong second choice (cookieless, 2.5 KB, GSC integration). Rejected on cost (only billed option) plus a new third-party processor, while still pageview-only — it pays money and still can't answer the Worker-headroom question.                                    |
| Umami (self-hosted, substitute for Plausible) | Same cookieless posture but self-hosting adds server ops to a deliberately static architecture. Loses to both finalists; revisit only if subscription cost is ever a veto AND the team accepts the ops burden.                                                        |

## Integration sketch (no code — follow-up work)

- `src/config.yaml` shape: add a sibling vendor block mirroring the
  existing pattern, e.g. `analytics.vendors.cloudflare: { token: null }`;
  leave the `googleAnalytics` branch untouched. Default stays disabled.
- `Analytics.astro`: extend the existing `isEnabled`-style gate (render
  nothing without a configured token) for the beacon `<script
src="https://static.cloudflareinsights.com/beacon.min.js">`, or add a
  small `CloudflareAnalytics.astro` component owned by the same file's
  convention. Partytown does not apply (the beacon is a module/RUM script,
  not gtag) — keep it off the Partytown path and note why inline.
- `CommonMeta.astro:11`: apply the criterion-(4) delta for the chosen
  endpoint variant (own-domain `/cdn-cgi/rum` preferred if the zone's
  proxying supports it, else `cloudflareinsights.com`).
- Search Console fit: GSC remains the search-query source (free, no script,
  no CSP change); pair its query/click data with WA pageviews manually in
  each informe — no code integration proposed.
- First informe periódico outline (activates `transparencia.md:27`),
  published as a new subsection of `/transparencia/`: top pages, referrers,
  GSC queries, Worker invocations/day vs the 100k budget, search-artifact
  size vs the 150 KB budget, decision log (what changed because of the
  numbers).
- Dashboard surfacing next: feed WA top-pages + Worker invocation counts
  into `src/pages/admin/dashboard.astro` (`DashboardMetrics`, currently fed
  by `data/metrics/pipeline-metrics.json`) — manual paste first, automate
  via API export only if the manual cadence proves its value.

## Privacidad / Transparencia follow-ups (proposed wording only — not made)

- `privacidad.md`: name Cloudflare Web Analytics in the Proveedor de
  Servicios / Datos de Uso sections; state cookieless, aggregate-only,
  no-banner operation; confirm the no-banner position under Chile Ley
  19.628 with legal before publishing.
- `transparencia.md`: activate the `transparencia.md:27` "cuando estén
  disponibles" clause with a publication cadence once the first informe
  ships.

## Open questions

1. Beacon delivery: proxied auto-injection vs manual snippet (Cloudflare
   docs note auto-injection fails under `Cache-Control: public,
no-transform` — which variant works for GitHub Pages output)?
2. Does legal confirm the no-consent-banner position under Chile Ley 19.628
   for a cookieless, aggregate-only beacon?
3. Are Workers Observability / per-route invocation counts on the Free plan
   sufficient to settle ADR-0008, or is any upgrade needed?
