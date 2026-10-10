# Search SEO backlog: independently executable work packages

**Program:** [README.md](README.md) | **Execution:** [AGENT_HANDOFF.md](AGENT_HANDOFF.md) | **State:** [IMPLEMENTATION_LEDGER.md](IMPLEMENTATION_LEDGER.md).

This backlog is a **prioritized queue, not an instruction to implement everything in a single PR**. Every task starts with a fresh code/GSC review. A conditional task may close as **NOT_NEEDED** with supporting evidence. An account or editorial action must be recorded distinctly from a merged code change. Risk and effort are approximate and should be adjusted from current repository reality.

## Ordering and priority

- **Immediate, low-risk evidence:** SEO-01 -> SEO-02 -> SEO-03.
- **Editorial growth critical path:** SEO-04 -> SEO-05 -> SEO-06 -> SEO-07 -> SEO-08; measure throughout.
- **Conditional enhancements:** SEO-09 through SEO-14; execute only if a verified problem or opportunity justifies them.
- **Program review:** SEO-15; gates for continuation are editorial quality and incremental value, not vanity metrics.
- **External program links:** issue #233 owns cadence experiments; issue #234 owns Discover science. Do not duplicate tickets or claim their work completed.

## SEO-01 — Reproducible baseline and tracking (P0)

**Outcome:** One reproducible snapshot, by settled date, of Search performance and the priority URL cohort.

**Estimate:** 2–4 hours, mostly analysis. **Risk:** Low. **Dependencies:** Read-only GSC access.

**Steps:**

1. Query sc-domain:noticiencias.com for 28 and 90 complete days: site summary, queries, pages, query-by-page where supported, and date series. Record the returned last settled day and data source.
2. Split query-level performance into branded (at minimum “noticiencias”, “noticiencia” and validated variants) versus non-branded. Report unclassified/anonymized difference instead of pretending dimensions reconcile exactly.
3. Separate the August 22–23, 2026 “inteligencia artificial” / MIT-automation outlier from repeated topical traffic. Measure unique topic queries and landing URLs without extrapolating from two days.
4. Record homepage, strongest article pages, representative category/series pages and a 10–20 URL inspection sample. Prefer existing GSC and GitHub evidence, no new analytics platform.
5. Document the cohort, query filters and date ranges in the ledger. Use existing docs/EDITORIAL_METRICS.md and docs/ANALYTICS_OPERATOR_CHECKLIST.md before creating new metrics or dashboards.

**Acceptance:** Re-runnable queries and source references; both windows have consistent endpoints; zero invented analytics; GSC lag and anonymized-query caveats explicit; no ad/consent config touched.

**Done evidence:** Dated metric snapshot, top five query/page opportunities, comparison caveats, follow-up priority.

## SEO-02 — Sitemap submission diagnostics (P1 quick win)

**Outcome:** Confirm the current XML sitemap is known to the verified Search Console property and its errors can be inspected.

**Estimate:** 15–45 minutes. **Risk:** Low. **Depends on:** SEO-01.

**Steps:** Re-query submitted sitemaps; verify https://noticiencias.com/sitemap-index.xml and https://noticiencias.com/sitemap-0.xml return correct URLs and are referenced by robots.txt. If the property still lists no submitted sitemap **and authenticated submission is available**, submit the existing index once. If it is already present, skip. Read status/warnings after Google processes it; processing can be asynchronous.

**Acceptance:** Submission receipt or existing submission recorded with property, URL, timestamp, and state. No code change, fabricated “indexing boost”, URL resubmission spam, or modification to robots.txt without a demonstrated defect. Record access limitations as BLOCKED if account access is unavailable.

**Done evidence:** Search Console submitted-sitemap entry/status or precise failure.

## SEO-03 — Canonical, indexability and structured-data triage (P0)

**Outcome:** Identify real search technical blockers, not auto-fix scanner heuristics.

**Estimate:** 3–5 hours. **Risk:** Low to medium if a fix is needed. **Depends on:** SEO-01.

**Steps:**

1. Sample 10–20 URLs: homepage, articles from different categories/date cohorts, category page 1 and pagination, series, and legacy permalink exceptions. Inspect selected GSC URLs, page HTML, robots directives, canonical, HTTP status and sitemap presence.
2. Compare canonical/URL trailing-slash behavior with src/utils/permalinks.ts, src/config.yaml and astro.config.mjs. A correct 301/308 from a slashless alias is not a defect.
3. Validate NewsArticle output for two distinct articles and Organization publisher/author objects against Google's documentation and a current structured-data validator. The earlier on-page scanner found two medium “Organization logo” observations; inspect **which Organization** it flags because the publisher already has a logo.
4. Record actual indexing exclusions and whether they are intentional: /buscar/, /llm-md/, /temas/, social-manifest, pagination. Do not blanket-noindex or force-index them.
5. Open a narrowly scoped fix PR **only if** a wrong canonical, unexpected noindex, broken link, invalid supported schema field or a material URL bug is reproduced. Add a regression test on the affected path.

**Acceptance:** Findings classified FIX / EXPECTED / UNCERTAIN with URL, reproduction and Google evidence. Preserve metadata flow src/components/template/common/Metadata.astro. No wholesale rewrite of JSON-LD, SEO dependency upgrade or schema proliferation.

**Done evidence:** URL audit table and validation results; targeted CI/deploy proof if code changed.

## SEO-04 — Reader intent and editorial opportunity matrix (P0)

**Outcome:** A ranked shortlist of 6–10 topics that merit editorial effort, not a generic keyword dump.

**Estimate:** 3–5 analysis hours + 1–2 editorial review hours. **Risk:** Low. **Depends on:** SEO-01.

**Steps:**

1. Inventory existing published coverage by category, tag, series, article URL and primary sources, reusing src/utils/blog.ts and src/utils/series.ts/source-of-truth maps where useful.
2. Combine actual GSC topic-level queries/pages, current reader questions, credible primary research availability, a representative live SERP/competition sample, seasonality, and audience relevance.
3. Prioritize specific, answerable scientific questions over broad “noticias de química/física” terms. Treat the MIT AI spike as a **hypothesis generator**, not lasting keyword dominance.
4. For every candidate document: reader intent; existing Noticiencias URLs; content gap; original analysis or explanatory synthesis possible; primary-source inventory; competing results; estimated editorial effort; expected shelf life; factual/YMYL risk; internal-link fit; measurement query set.
5. Choose two cluster pilots **after** observing evidence; candidates can include the existing IA en la práctica or Espacio series. Do not create new taxonomies from speculation.

**Acceptance:** Ranked opportunity sheet with clear accept/reject reasons and at least three discarded ideas; human/editor decision logged. A volume or keyword score alone does not approve content.

**Done evidence:** Dated shortlist and the first two approved, non-overlapping intent hypotheses.

## SEO-05 — Existing topic hub pilot (P1)

**Outcome:** One useful destination integrating already published work and original explanatory context.

**Estimate:** 4–8 hours per hub including editorial verification. **Risk:** Medium (page changes). **Depends on:** SEO-04.

**Steps:** Select one existing category or series page supported by source inventory and relevant demand. Add a succinct, genuine explanation answering central reader questions, a curated reading sequence, specific subtopic navigation where warranted, and contextual connections among already published findings. Reuse src/pages/categorias/[category]/[...page].astro, src/pages/series/index.astro, src/components/common/TopicHubHeader.astro and established series/category description maps as appropriate. Keep the original list accessible; avoid a duplicate route, an invented keyword landing page or unsupported content changes. Add or refine links from relevant real articles.

**Acceptance:** No duplicate canonical, title or metadata; one clear h1; meaningfully differentiated human-readable value, not filler; real links; mobile 375px / desktop 1280px and keyboard checks; appropriate regression tests; deployed smoke validation; unchanged category ownership and backend metadata contract.

**Done evidence:** Hub URL, before/after narrative, primary sources where new facts were added, tests and SEO tracking cohort.

**Expansion condition:** Pilot a **second** existing hub only after editorial review and user engagement/indexability checks. No assumption that sparse chemistry or physics category pages require arbitrary extra words.

## SEO-06 — Editorial internal-link improvement (P1)

**Outcome:** Readers and crawlers can follow genuine topical relationships between hubs, explainers and sources.

**Estimate:** 3–6 hours for a limited pilot. **Risk:** Low–medium. **Depends on:** SEO-05.

**Steps:** Inspect src/utils/related.ts, src/components/common/RelatedReading.astro, src/components/common/TopicStrip.astro and existing article lists first. Choose 6–10 pages with verified topical relationships and add **contextual, descriptive editorial links** where relevant; check that existing auto-related cards are not sufficient before adding logic. Avoid sitewide exact-match anchors or footer link farms. Keep one canonical URL per destination. Test links in the built dist/ and mobile rendering.

**Acceptance:** Each added link has a plausible reader journey and resolves; no misleading “Relacionado” label for unrelated content; no duplicate recommendation widget or new client-side framework.

**Done evidence:** Source/destination URL map and changed-path deploy verification.

## SEO-07 — Original evergreen/synthesis article pilot (P0 editorial)

**Outcome:** One highly useful, evergreen, answer-first scientific resource demonstrably distinct from any single upstream article.

**Estimate:** 6–12 editorial hours per article; four candidates over 12 weeks if capacity and evidence justify. **Risk:** High editorial, low technical if contract unchanged. **Depends on:** SEO-04; ideally SEO-05.

**Steps:**

1. Select one approved reader question and explicitly define what the piece contributes: original comparison, evidence synthesis, limits, explanatory diagram made from verified facts, historical progression or carefully delimited practitioner insight.
2. Read and record primary sources before drafting. Cite factual claims to their actual studies, distinguish study types, note sample sizes/statistical constraints where material and keep uncertainty legible.
3. Draft in Spanish with a directly useful answer, logical headings, non-sensational title, meaningful excerpt, source attributions, rights-cleared image and informative alt. Verify the reader learns more than a paraphrase of a secondary source.
4. Human editorial approval required; confirm no plagiarism, invented findings or YMYL overreach. Honor src/content.config.ts, docs/tagging.md and backend schema/publication ownership. Avoid direct frontend publication of drafts that require the production backend approval flow.
5. Link the article from an existing suitable hub, add relevant internal citations/navigation, verify JSON-LD/canonical, sitemap/RSS and live page after approved publication.
6. Track 7/28/90-day Search cohort and editorial cost; make a continue/adjust/stop decision before multiplying output.

**Acceptance:** Primary-source and factual evidence trail, concrete original-value statement, human publication approval, valid content/schema/image/right checks, no date manipulation, published URL and tests. Publishing is **blocked**, not faked, if the actual editorial database/queue cannot be accessed.

**Done evidence:** Article URL, editorial checklist, source inventory, primary originality contribution and cohort ID.

## SEO-08 — Selective legacy improvements (P1 editorial)

**Outcome:** Improve useful existing articles instead of publishing a large duplicate inventory.

**Estimate:** 1–3 hours each; pilot two, expand to six–eight total only when justified. **Risk:** Medium. **Depends on:** SEO-01, SEO-04.

**Steps:** Rank candidates by topic relevance, impressions without clicks, missing direct answers, outdated evidence and clear quality deficits. Read the source paper and existing correction trail. Add only supported new value: clarify limitations, update outdated evidence with version dates, answer related reader questions, strengthen references or links. Keep existing permalink. Use corrected_at/correction_summary and updateDate only according to actual schema and correction policy; do **not** change publish dates for “freshness”.

**Acceptance:** Before/after scientific and reader-value rationale; no unsupported extrapolations; sourced factual additions; content validation and deploy check; no automatic bulk rewriting.

**Done evidence:** 2-article pilot log, later cohort comparison, documented decision not to change adequate pages.

## SEO-09 — Title and snippet relevance pilot (P1 conditional)

**Outcome:** Better search-result promise for pages with measured relevant impressions and weak CTR, without clickbait.

**Estimate:** 2–4 hours. **Risk:** Low–medium. **Depends on:** SEO-01, SEO-04.

**Steps:** Choose up to five pages only after excluding brand/search-intent mismatches and tiny denominators. Inspect the visible h1, head title, meta description and GSC query intent. Rewrite where specificity, scientific meaning or clarity are demonstrably weak. Respect the fact Google may use its own title/snippet and has no fixed meta-description length limit. Keep page on-topic; don't attach keywords unrelated to the article. Check social metadata and SERP presentation manually after crawl.

**Acceptance:** Original claims preserved, distinct titles/descriptions, safe display at common widths, no keyword stuffing, exact paths tracked. **No guaranteed CTR uplift** claimed.

**Done evidence:** Change log, URL cohort, baseline CTR/impressions and 28+ day follow-up.

## SEO-10 — Discover/image eligibility triage (P2 conditional)

**Outcome:** High-potential articles offer rights-cleared, representative images large enough for eligible Google previews where feasible.

**Estimate:** 3–5 hours to audit + variable editorial asset time. **Risk:** Medium for image pipeline/media rights. **Depends on:** SEO-01 and editorial ranking.

**Steps:** Sample top priority articles, inspect actual HTML image URL, srcset, og:image, JSON-LD image and source resolution. An inspected September Herculaneum article exposed 777 × 514 OG image; verify current derivative/source asset before remediation. For worthy pages, select an existing verified 1,200px+ original or licensable asset with coherent crop and truthful alt; if no suitable asset exists, leave a known limitation rather than upscale or steal one. Reuse src/components/common/Image.astro and established image manifest/delivery mode. Verify rendered metadata, image HTTP response and LCP impact. Coordinate Discover measurement with #234.

**Acceptance:** Verified rights/provenance and usable resolution, no image regression, no accidental R2 uploads/deletes, no falsely claimed Discover eligibility or traffic.

**Done evidence:** Sample audit, chosen changes, image dimensions/URLs, deployment checks.

## SEO-11 — Structured metadata and author identity validation (P2 conditional)

**Outcome:** Accurate existing structured data representing actual editorial attribution.

**Estimate:** 2–4 hours. **Risk:** Medium if shared layout changed. **Depends on:** SEO-03.

**Steps:** Inspect actual JSON-LD from src/layouts/PostLayout.astro; compare publisher Organization and author Organization with displayed author, attribution to upstream sources, corrections, dates and Google's Article guidelines. Validate suspected schema warnings with a current parser/Rich Results Test. Only modify when a concrete inconsistency is confirmed. Link genuine editor/about information; don't invent credentials, expert authors or pretend source newsrooms wrote Noticiencias articles.

**Acceptance:** Page-visible attribution, JSON-LD and policy consistent; tests cover both original and AI-assisted editorial bylines; no extra schema types without a consumer; no “E-E-A-T score” claimed.

**Done evidence:** Screenshots or validator output of before/after; test and deploy result.

## SEO-12 — Mobile UX and performance evidence (P2 conditional)

**Outcome:** Confirm whether speed/usability actually blocks reader discovery, and fix measured issues only.

**Estimate:** 3–5 analysis hours; fixes scoped separately. **Risk:** Variable. **Depends on:** SEO-01.

**Steps:** Measure representative homepage, listing and article URLs at phone and desktop using available Lighthouse/PageSpeed lab data; use CrUX field data only when the integration and sample size support it. Report LCP, INP (if field data), CLS and device/network/context. Inspect source images, fonts, client scripts and layout shifts. Compare with existing .github/workflows/perf-monitor.yml and avoid duplicate monitors. Fix only a reproducible, impactful regression with focused tests and real device-width verification.

**Acceptance:** Measurement and caveats precede code; no unsupported Core Web Vitals status; changes don't degrade readability, keyboard navigation, images or consent.

**Done evidence:** Method, URL/date/run evidence, before/after metrics where comparable, CI/deploy.

## SEO-13 — Earned authority and distribution (P1 ongoing)

**Outcome:** Genuine editorial references and qualified readers from primary-source-aligned communities.

**Estimate:** 1–3 hours/week when credible opportunities exist. **Risk:** Low if ethical. **Depends on:** SEO-07 or materially improved SEO-08.

**Steps:** Assemble a small list of institutions, science newsletters, specialist communities and relevant writers for whom a specific article provides independently useful explanation. Share the resource with a short honest rationale; record outreach and referral results. Use existing social distribution workflow and channels without spam automation. Offer corrections and source credits promptly; preserve independent editorial voice.

**Acceptance:** No paid backlinks, link schemes, mass unsolicited email, invented endorsements or purchased “DR”. Record actual earned citations/referral visits instead of counting sent messages as authority.

**Done evidence:** Qualified outreach log, public reference URLs when they exist, traffic attributable only where measured.

## SEO-14 — Coordinate cadence/Discover without ownership collision (P2 conditional)

**Outcome:** Make Search-specific lessons available to adjacent experiments without changing publication controls.

**Estimate:** 1–2 analysis hours per checkpoint. **Risk:** Medium if experimental ownership is ignored. **Depends on:** SEO-01 and any article cohort.

**Steps:** Share observed Search topic demand and indexed/cohort behavior with [#233](https://github.com/cortega26/noticiencias/issues/233) and [#234](https://github.com/cortega26/noticiencias/issues/234). Do not duplicate their measurements, reconfigure scheduled collection or increase publishing rates without the bounded cadence experiment. Treat Google Discover as an independent surface that may have no measurable activity. Respect backend-runner availability and the production DB integrity boundary.

**Acceptance:** Explicit handoff notes, no two conflicting experiments on the same cohort, clear stop if cadence threatens science quality.

**Done evidence:** Linked issue note or cross-reference; no fabricated backend state.

## SEO-15 — Evaluate, decide, and prevent drift (P0 ongoing)

**Outcome:** At weeks 4, 8 and 12, decide with evidence whether each initiative merits further investment.

**Estimate:** 2–3 hours per checkpoint. **Risk:** Low. **Depends on:** SEO-01 and completed pilots.

**Steps:** Refresh Search windows and stable URL cohorts; compare old/new article performance, non-brand topics, index coverage samples, editorial correction count, engagement where measured, resource cost and possible timing confounders. Re-check the August 2026 traffic spike separately. Make one of CONTINUE / ADJUST / STOP / INSUFFICIENT DATA decisions per active initiative; record why and the next smallest measurable action. Do not declare success from a single query snapshot or an unverified third-party “SEO authority” score.

**Acceptance:** Every recommendation is supported by dates, observations and limitations. State insignificant/no-data results plainly. If the site is too small to attribute effects, prefer longer observation to forced statistical conclusions.

**Done evidence:** Three decision entries with metrics, reproducible filters, evidence URLs and accepted next steps.

## Appendix: risk-specific validation

- **Docs/analysis only:** baseline npm run lint and npm run validate:content when execution environment is available; repository CI is authoritative.
- **Article/frontmatter edits:** both baseline commands; check permalink, source provenance, schema, RSS/sitemap, and correction/translation policy.
- **Page/component/metadata/image edits:** npm run lint, npm run validate:content, npm run build, npm run test:dist, npm run test:audit; add targeted regression checks and verify 375px and 1280px before merging.
- **High-risk schema or backend integration:** follow AGENTS.md and docs/SOURCE_OF_TRUTH.md; coordinate with the backend schema contract and its tests. Do not treat the SEO plan as authorization to change the backend contract.
- **Any deployed change:** CI green, responsible squash merge only after validation, GitHub Pages status green, real canonical/meta/navigation/image smoke verification, ledger updated with PR, SHA and dated evidence.
