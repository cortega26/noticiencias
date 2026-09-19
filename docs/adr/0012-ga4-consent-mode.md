# ADR-0012: GA4 with Consent Mode v2 as the events layer, Cloudflare kept as the cookieless baseline

- **Date**: 2026-09-18
- **Status**: Accepted (operator 2026-09-18)
- **Supersedes**: ADR-0011 in part — it reverses the vendor exclusion of GA4
  and keeps everything ADR-0011 decided about Cloudflare Web Analytics.

## Context

ADR-0011 evaluated three vendors against six criteria and chose Cloudflare Web
Analytics. That evaluation is not disputed here: on cost, privacy posture,
consent-banner burden and script weight, Cloudflare wins and GA4 loses.

What ADR-0011 did not weigh is **what the data would later be used for**. Its
criteria measured the cost of collecting pageviews, not the value of what is
collected. The operator has since stated the goal explicitly: instrument the
site in order to evaluate monetization options. Against that goal, a
pageview-only, cookieless beacon is insufficient, and the gap is structural
rather than a matter of configuration:

- No custom events, so no conversion measurement. Which article drives a
  newsletter signup is unanswerable, and that question is the basis of both
  affiliate and sponsorship reasoning.
- No returning-user or cohort analysis. Recurring audience is the asset a
  sponsor buys; Cloudflare deliberately cannot link a visitor across days.
- No engagement depth (real read time, pages per session), which is what any
  CPM conversation rests on.
- Shallow channel segmentation, so Discover / Search / social / newsletter
  cannot be separated and compared.

Two facts about the current tree also bear on this decision:

- Analytics is off in both branches (`src/config.yaml:74` GA id `null`,
  `src/config.yaml:80` Cloudflare token `null`).
- **The GA branch was not merely disabled, it was broken.**
  `configBuilder.ts` defaulted `partytown: true` and `Analytics.astro` applied
  `type="text/partytown"` to both GA scripts, while `@astrojs/partytown` is not
  installed and not registered in `astro.config.mjs`. A browser treats
  `text/partytown` as an unknown MIME type and never executes the script.
  Configuring a valid `G-` ID would have produced zero data and zero errors.
  ADR-0011 inherited this plumbing as "incumbent" without testing it.

## Decision

Adopt **GA4 with Consent Mode v2 (advanced)** as the events and KPI layer, and
**keep the Cloudflare Web Analytics beacon** as a cookieless baseline running
alongside it.

Four sub-decisions, taken by the operator on 2026-09-18:

| Decision                             | Choice                 | Rationale                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent Mode                         | **Advanced**           | `gtag.js` loads on every page with all four signals defaulted to `denied` and sends cookieless pings, letting GA4 model the behaviour of visitors who decline. Basic mode would withhold the script entirely and leave the declining segment fully dark — which is the measurement gap this ADR exists to close. |
| Banner scope                         | **All visitors**       | One flow, no geolocation. A static site cannot resolve country without pushing logic into the Worker; a single banner satisfies Chile's Ley 19.628 and GDPR-style regimes at once.                                                                                                                               |
| Cloudflare beacon                    | **Kept alongside GA4** | It measures the visitors GA4 cannot, so the ratio between the two calibrates consent bias. Free, cookieless, already built (plan 007).                                                                                                                                                                           |
| Google Signals / ads personalization | **Off initially**      | Keeps `connect-src` tight (no `stats.g.doubleclick.net`) and avoids a second legal basis. Revisit only if monetization goes through an ad network.                                                                                                                                                               |

Advanced Consent Mode is the substantive trade: a Google-owned script loads
before the visitor has decided anything. This is a real privacy cost, accepted
knowingly, and it obliges the privacy policy to disclose it in those terms
rather than describe the site as tracker-free until consent.

## Consequences

Harder:

- A consent banner must be built and maintained: static HTML plus a scoped
  inline script, idempotent across `ClientRouter` page transitions (LAW-F3),
  with accept and reject given equal visual weight, and no layout shift.
- `gtag('consent', 'default', ...)` must run before `gtag.js` loads. Ordering
  is load-bearing: a `default` call that arrives after `config` leaves a window
  in which `_ga` was already written.
- Partytown must go. It moves gtag to a web worker and breaks that ordering,
  and it never worked here anyway. The `partytown` flag is removed from the
  config type rather than set to `false`, since a flag with no integration
  behind it is the single-consumer abstraction `AGENTS.md` §4 rejects.
- `connect-src` gains `https://*.google-analytics.com` and
  `https://*.analytics.google.com` (GA4 shards endpoints by region). The
  wildcards do not implicitly cover the bare or `www.` host, so the existing
  `https://www.google-analytics.com` entry stays.
- **`transparencia.md:23` has to change.** It currently commits to "Solo usamos
  métricas agregadas sin PII", and a `_ga` client ID is not that. This is a
  published commitment being revised, not a rewording.
- `privacidad.md:53-59` must be rewritten: it currently announces Cloudflare
  operating without a banner.
- Script weight rises (~135 KB gzipped for `gtag.js` versus ~30 KB for the
  beacon), which LAW-F8 requires be scored. Mitigated by keeping GTM and any
  CMP bundle out, and by loading gtag `async`.

Easier:

- Conversion, cohort and channel analysis become possible, which is the
  point.
- Search Console can be linked to GA4, joining query data to on-site
  behaviour without a second pipeline.
- The Cloudflare/GA4 ratio gives an empirical consent-decline rate instead of
  an assumed one.

Unchanged from ADR-0011:

- Cloudflare Web Analytics stays the cookieless baseline, with the same token
  gate, the same `static.cloudflareinsights.com` CSP entry and the same
  own-domain `/cdn-cgi/rum` delivery.
- Worker headroom telemetry (ADR-0008) remains vendor-independent via
  `workers/wrangler.toml` observability. Criterion (6) of ADR-0011 is still not
  answered by any beacon, and this ADR does not claim otherwise.

## Rejected alternatives

| Option                        | Why not                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stay on Cloudflare only       | Cheapest and cleanest, but structurally cannot answer the monetization questions above. Rejected on fitness for purpose, not on quality.                                                                                                                                                                                                                                                                                    |
| Plausible Cloud               | Custom events, ~2.5 KB, no banner — the best privacy-preserving way to get events. Rejected because it is billed, adds a third-party processor, and is not the currency ad networks and sponsors speak; if an ad network is adopted later, a consent banner is needed regardless, at which point GA4's marginal cost drops to zero. Revisit if the monetization path turns out to be reader-funded rather than advertising. |
| Basic Consent Mode            | Cleaner privacy posture and zero weight for those who decline, but no modelling, leaving the declining segment unmeasured.                                                                                                                                                                                                                                                                                                  |
| Geo-gated banner (EU/UK only) | Less friction for the majority LatAm audience, but a static site has no country signal; resolving it means coupling the banner to the Cloudflare Worker.                                                                                                                                                                                                                                                                    |

## Open questions

1. Does the operator's legal position under Ley 19.628 accept advanced Consent
   Mode, given that `gtag.js` loads pre-consent? ADR-0011's open question 2
   asked the narrower cookieless-beacon version of this and is still open.
2. GA4 data retention defaults to 2 months and the change is not retroactive —
   confirmed as an operator task before meaningful traffic accumulates.
3. Does the Worker (`workers/src/index.ts`, which already intercepts all zone
   HTML) become the CSP emitter, replacing the manual Transform Rule? Deferred,
   recorded here so the option is not lost.
