# Noticiencias: Search SEO growth program (October 2026)

**Status:** Proposed execution plan; no implementation work is authorized by this document alone.
**Scope:** Search SEO for noticiencias.com, with explicitly separate coordination for Discover.
**Baseline:** 10 October 2026 (Search Console settled through 6 October).
**Execution horizon:** 12 weeks, followed by a 90-day observation window when needed.
**Primary repository:** cortega26/noticiencias.
**Publishing backend:** cortega26/noticiencias_news_collector.

This program is an evidence-led continuation of the September 2026 editorial/UX improvements. It is **not** a redesign, a framework migration, a mandate to increase publishing volume, or an AdSense approval guarantee. It preserves AGENTS.md, docs/SOURCE_OF_TRUTH.md, editorial accuracy, reader trust, stable URLs, the existing Astro metadata pipeline, and the backend's publication ownership.

## 1. Executive decision

**Primary problem:** Google can crawl and index sampled Noticiencias pages, but the site attracts very little sustained, non-branded Search traffic. Technical changes alone will not solve this.

**Strategy:** Prove demand, develop a few genuinely helpful topic destinations, publish a small number of distinctive primary-source-backed explainers, improve relevant internal links, then evaluate cohorts. Fix specific technical defects as they are confirmed. Keep Search and Discover metrics separate.

**Work ordering:** measurement and diagnosis -> one low-risk indexing action -> editorial opportunity selection -> one topic-hub pilot -> original content and links -> focused technical remediation -> 30/60/90-day evaluation.

Detailed tasks and acceptance criteria: [BACKLOG.md](BACKLOG.md).
Progress state and evidence log: [IMPLEMENTATION_LEDGER.md](IMPLEMENTATION_LEDGER.md).
Agent operating instructions: [AGENT_HANDOFF.md](AGENT_HANDOFF.md).

## 2. Verified baseline (snapshot, not a permanent truth)

Sources: connected Google Search Console property **sc-domain:noticiencias.com**, production pages, the public sitemap, the October 2026 repository main branch, and a live 10-page on-page audit. Refresh before implementing; Google data settles late and search performance varies.

### Search Console

- **28 settled days through 2026-10-06:** 21 clicks, 121 impressions, 17.36% CTR, average position 16.62; 10 fewer clicks and 291 fewer impressions than the previous comparable period.
- Of those clicks, 15 were reported for query “noticiencias” and 5 for “noticiencia”; the **20 named branded-query clicks are not evidence of topic reach**. One additional site-level click was not assigned to those named queries. Anonymous queries and dimensions can make subtotals non-additive.
- **90 settled days through 2026-10-06:** 55 clicks, 648 impressions, 8.49% CTR, average position 19.07. Do not compare these totals with 28-day totals without normalizing windows.
- **Important outlier:** query “inteligencia artificial” produced 19 clicks and 231 impressions on August 22–23, all associated with the May 7 MIT/automation article. It did not establish durable search visibility: both the query and URL had no later reported activity in the inspected daily series. Do not extrapolate a permanent first-place ranking from that two-day burst.
- Over 90 days, the Física category recorded 44 impressions, no clicks, average position about 75; Química 36 impressions, no clicks, average position about 70. These are weak signals, **not evidence that expanding either category automatically creates demand**.

### Crawling, content and SEO implementation

- Public [sitemap index](https://noticiencias.com/sitemap-index.xml) resolves and exposes one [child sitemap](https://noticiencias.com/sitemap-0.xml), observed with **77 URLs**. robots.txt references the sitemap.
- The connected Search Console property's submitted-sitemap list was empty at baseline. This does **not** mean the sitemap is inaccessible or Google has not discovered URLs. Submission improves diagnostics, not ranking.
- Four historical URL inspections passed: homepage plus sampled September and May articles were indexed, fetchable and allowed for mobile Googlebot. This is **not** a site-wide index coverage rate.
- The 10-page live technical audit: 10 indexable pages, **0 critical**, **0 high**, **2 medium**, **18 low** observations. The two medium observations flagged missing Organization logos on article schema; the article publisher object already includes a logo in src/layouts/PostLayout.astro. Verify the exact flagged JSON-LD node and Google validator before any modification.
- The automated audit also flagged redirect-to-trailing-slash, long titles/descriptions and short listing pages. These are **investigation candidates**, not automatically defects. Google has no required article word count or fixed meta-description character limit.
- The homepage and inspected article pages expose titles, descriptions, self-canonical URLs, robots index/follow, Open Graph and Twitter metadata. Articles already emit NewsArticle JSON-LD and existing related-reading widgets.
- An inspected article exposed an Open Graph image of 777 × 514 pixels, below Google's 1,200-pixel recommendation for large Discover images. This is a **sample**, not evidence that every hero image is unsuitable. Prefer real, rights-cleared high-quality assets over artificial upscaling.
- Latest publicly displayed publication in the inspected edition: **2026-09-25**. The homepage was corrected to describe the edition honestly. Collector workflow success is not evidence of actual publication; local editor queue access was not verified.
- Mobile Core Web Vitals were **not measured**: the connected CrUX-history integration had no configured API key. Do not label performance good or bad without measurement.

### What already exists; do not rebuild

- Astro SSR-free/static output, canonical URL helpers, the shared metadata path, robots/sitemap/RSS generation, NewsArticle JSON-LD, content schema, category/tag/series routing, search UI, source and correction disclosures, editorial methodology, related-reading logic, article images and deployment smoke checks.
- Tags at /temas/ are intentionally noindex and excluded from the sitemap according to docs/SOURCE_OF_TRUTH.md. Do not reinstate them into the sitemap for an arbitrary URL-count target.
- The September 2026 product/UX program has already implemented many editorial/navigation improvements. Review docs/products/audit-2026-09/ before creating replacement functionality.
- Existing experiments: [publishing cadence #233](https://github.com/cortega26/noticiencias/issues/233), [Discover Reality Lab #234](https://github.com/cortega26/noticiencias/issues/234). Both own their domains; this program contributes Search findings without duplicating them.

## 3. Desired outcomes and measurement discipline

The north star is **qualified, sustainable non-branded organic discovery of useful articles**, not raw indexed pages, number of posts, an SEO “score”, or transient ranking screenshots.

Track these each week, on identical settled windows:

1. **Search non-branded clicks and impressions**, 28-day rolling, compared with a preceding 28-day window; maintain an explicit brand-token exclusion set (“noticiencias”, “noticiencia”, agreed variants). Report anonymized/unclassified traffic separately and acknowledge query filters do not always reconcile to property totals.
2. **Search clicks and impressions per article and per topic cluster**, including new versus existing URLs, 7/28/90-day cohorts, and impression concentration. Segment high-intent science queries from generic brand searches.
3. **Index diagnostics:** submitted-sitemap status; for a stable sample of priority URLs, indexation verdict, page fetch, canonical match, and last crawl. Never infer an overall index percentage from four URL inspections.
4. **Search discovery quality:** organic entrance paths, next-article engagement and confirmed newsletter subscriptions when privacy-compliant existing measurements are available. Keep consent-denied traffic and attribution gaps explicit.
5. **Editorial safety:** factual corrections, unverifiable assertions, source provenance, plagiarism/near-duplicate findings, review time and copyright/media compliance.
6. **Technical health:** broken links, invalid canonical/structured data, mobile layout and Core Web Vitals, only when instrumentation can substantiate a claim.
7. **Discover:** its own impressions/clicks/CTR and article cohorts **only if actual Discover data exists**; no invented Discover lift.

### Measurable 12-week deliverables (controllable targets)

- Baseline report and a reusable, low-maintenance weekly scorecard with reproducible date ranges and data-source notes.
- Sitemap submission/status verified **if not already submitted at implementation time**.
- Index/canonical audit of 10–20 representative URLs with documented remediation decisions.
- One prioritized opportunity matrix with search intent, evidence requirements, originality opportunity, competition proxy, publication effort and current coverage.
- **Two existing** topic/series destinations improved where there is demonstrable editorial depth and reader utility; no automatic creation of new category routes.
- **Four** high-value, substantially original, fact-checked evergreen/synthesis resources **only if the evidence and editorial review capacity exist**. Start with one and validate the process.
- **Six to eight** selective legacy article improvements, with a change log and primary-source validation; leave satisfactory articles alone.
- Internal-link and image/metadata pilots on high-value pages without site-wide cosmetic churn.
- At least three monthly decisions recorded: continue, adjust or stop each major initiative, based on measured evidence and editorial cost.

### Directional outcome targets (not guarantees)

- By day 90, aim for repeatable non-branded impressions and clicks in more than one scientific topic, rather than a single two-day spike.
- Target an improvement in the rolling 28-day non-branded impression baseline and a growing number of distinct article URLs earning relevant non-branded impressions. Because volume is tiny, use **directional two-window confirmation** rather than claiming success from one extra click.
- If meaningful data accrues, a reasonable *stretch hypothesis* is doubling the October non-branded impression baseline within 90 days; explicitly report failure if not achieved. Do not represent it as a forecast or a condition to publish lower-quality articles.
- A 30-day ranking or revenue promise is **not** an acceptable program success metric. SEO outcomes can require several crawl, indexing and traffic cycles.

## 4. Proposed schedule, dependencies and effort budget

This is a sequential plan, not permission to open 15 simultaneous PRs.

- **Weeks 1–2 | Instrument/validate:** SEO-01 through SEO-04; settle baseline, Search Console sitemap, sampled indexation, first evidence/intent selection. Approx. 6–10 engineering/analysis hours plus editorial review.
- **Weeks 3–5 | Pilot:** one topic hub, 1–2 genuinely original evergreen pieces, first selective internal links; verify Search presentation. Approx. 8–14 engineering/editorial support hours plus 8–16 editorial hours.
- **Weeks 6–9 | Extend only what works:** second hub, up to two more original pieces, prioritized legacy revisions, limited headline/image fixes and distribution outreach. Approx. 10–18 engineering hours plus 12–24 editorial hours.
- **Weeks 10–12 | Evaluate:** performance validation, spot index checks, topic/cohort and editorial-cost comparison; decide keep/stop/next pilot. Approx. 4–8 analysis hours.

This is a planning budget (roughly 28–50 technical/analysis hours and 20–40 editorial hours over 12 weeks), not a deadline commitment. Prefer smaller output if source validation, editorial judgment, or machine access becomes the bottleneck. No filler content to meet volume targets.

Dependencies: current published-content contract, stable editorial decision process, connected GSC permissions, accessible production pages. Backend publication cadence/queue work must occur under the backend's own governance; do not infer queue state from a separate hosted SQLite database.

## 5. Non-negotiable controls

- **Helpful, original work:** no feed paraphrasing, bulk generated long-tail pages, unverified medical claims, fabricated expertise, copied text/media, sensational headings, or “SEO text” inserted merely to reach a word count. Human editorial accountability and authentic synthesis are essential.
- **Credible science:** distinguish preprints from peer review, human from animal or in-vitro studies, result from interpretation, association from causation, and current consensus from speculation. Link original research and publish transparent corrections.
- **No ranking manipulation:** no paid links, link exchanges, cloaking, doorway pages, keyword stuffing, SEO-only redirects or fabricated reviews/testimonials.
- **Existing architecture:** no schema contract or Astro/router redesign without a proven defect and coordinated backend change. Do not introduce additional SEO packages merely to duplicate existing functionality.
- **Stable URLs and dates:** preserve valid canonical paths and redirects; do not change publication dates to simulate freshness. Only revise dates according to the real content/metadata contract and correction policy.
- **AdSense and privacy:** do not enable ad scripts, change consent defaults or compromise UX to increase page views. Keep sponsored/editorial separation transparent.
- **Scope control:** one small, testable change per PR; CI and deployed verification when appropriate; no blanket rewriting of all historical posts; no new “SEO gates” without a demonstrated failure mode.

## 6. Decision model and stop criteria

Prioritize work by **expected reader value × relevance to observed demand × plausible impact × confidence**, divided by implementation/editorial cost and residual risk. Record uncertainty; the score is a queueing tool, not a search-ranking formula.

At week 4, week 8 and week 12, answer:

- Did priority pages gain relevant, persistent non-branded impressions or useful engagement?
- Did the work add clearly differentiated and verifiable reader value?
- Do new content and old-content refresh cohorts behave differently?
- Is there an indexability/technical bottleneck supported by Search Console?
- Were experiments underpowered, seasonal, or distorted by outliers?
- Is another investment worth its cost compared with editorial quality and distribution?

**Stop or change course** if accuracy or rights issues appear, if content becomes repetitive, if human review cannot keep up, if an optimization causes canonical/index regressions, or if a proposed technical task fails to demonstrate a real problem. A negative result is valid evidence; document it and move on.

## 7. Source of truth and references

Repository authority:

- [AGENTS.md](../../../AGENTS.md)
- [docs/SOURCE_OF_TRUTH.md](../../SOURCE_OF_TRUTH.md)
- [Existing SEO checklist](../../checklists/SEO_CHECKLIST.md)
- [September editorial/UX program](../audit-2026-09/README.md)
- [Publishing cadence issue #233](https://github.com/cortega26/noticiencias/issues/233)
- [Discover research issue #234](https://github.com/cortega26/noticiencias/issues/234)
- Backend: [news collector](https://github.com/cortega26/noticiencias_news_collector)

Primary Google guidance consulted in October 2026:

- [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Spam policies: scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Title links](https://developers.google.com/search/docs/appearance/title-link)
- [Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Discover guidance](https://developers.google.com/search/docs/appearance/google-discover)
- [February 2026 Discover core update](https://developers.google.com/search/blog/2026/02/discover-core-update)

**Evidence policy:** The baseline numbers above are dated observations, not hardcoded thresholds. Each executing agent should retain the observation date, Search Console date window, URL list, sample size, source, and any data-quality limitations in the implementation ledger. Do not substitute Google guidance for empirical measurements.
