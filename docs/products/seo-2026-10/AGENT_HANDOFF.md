# Autonomous agent handoff: Noticiencias Search SEO

This file is the **self-contained execution entrypoint** for an AI assistant taking over after the documentation plan PR is reviewed/merged. It does not supersede AGENTS.md or docs/SOURCE_OF_TRUTH.md, and it does not authorize bulk changes or automatic publication without existing editorial checks.

## Mission

Improve **sustainable, relevant, non-branded Google Search discovery** of noticiencias.com, while preserving scientific accuracy, privacy, copyright, page speed and AdSense readiness. Do so in small, attributable, reversibly scoped iterations. Prefer solving a demonstrated problem over adding process, infrastructure or content volume.

**Before touching code, read in order:**

1. AGENTS.md and docs/SOURCE_OF_TRUTH.md from the **current main commit**.
2. docs/products/seo-2026-10/README.md: evidence, scope, goals and non-goals.
3. docs/products/seo-2026-10/BACKLOG.md: exact task acceptance and dependencies.
4. docs/products/seo-2026-10/IMPLEMENTATION_LEDGER.md: latest completed steps and blockers.
5. Existing docs/products/audit-2026-09/ and, for any editorial content, docs/tagging.md, src/content.config.ts, plus relevant existing components, routes and source-of-truth docs.

## Next task selection

1. Find the highest-priority **NOT_STARTED** task whose dependencies are actually satisfied, ordinarily SEO-01, then SEO-02/SEO-03.
2. Refresh the current GitHub main SHA, open PRs, Search Console data through its last complete day, and site behavior; initial October numbers are a snapshot, not hardcoded truth.
3. Before changing anything, write a short task note: actual problem, cause/evidence, reader benefit, proposed minimal change, risk, likely test, rollback plan and observed baseline.
4. If a task is not needed, mark **NOT_NEEDED** in the ledger with evidence; do not invent work to maintain a checklist.
5. Limit implementation to one independently reviewable change. Use an isolated branch; another agent may be editing unrelated files simultaneously. Avoid file/branch collisions and don't rewrite others' open PRs.
6. Do the work yourself using available tools; do not hand the owner routine chores you can complete. If a required account, secret, proprietary production database or editor approval is inaccessible, record the exact blocker and work on a genuinely independent item without faking success.
7. Do not merge a failed CI or publish unreviewed medical/scientific claims. Follow repository-authorized merge policy; small responsible squash merges after green checks and deployment verification where possible.
8. Update only the relevant ledger entry in the same task PR, including status, tested URL(s), GitHub PR/commit, metrics data range, validation and caveats.

## Baseline facts that must not be misread

- 28 days through 2026-10-06: 21 GSC site clicks, 121 impressions; named brand queries accounted for 20 reported clicks. Not a healthy non-branded search baseline.
- 90 days: 55 clicks, 648 impressions; 19 AI-topic clicks occurred in a two-day August outlier, not a durable ranking.
- Public sitemap works and robots references it; GSC returned no submitted sitemap. Submitting it is a diagnostic action, **not** a guaranteed traffic improvement.
- Current article layout already emits NewsArticle JSON-LD. A scanner's warning about an Organization logo does not prove publisher markup is broken.
- /temas/ noindex and sitemap exclusion are deliberate. Do not reindex tag archives by default.
- Existing editorial data and user-facing copy already disclose AI assistance. Original human-accountable analytical value, sources and correction standards are mandatory.
- Backend collection runs and hosted /healthz do not establish the local production editorial queue's state. #233 owns cadence, #234 owns Discover. Keep Search SEO separate.

## Engineering protocol

- For docs/content-only changes: run npm run lint and npm run validate:content whenever the execution environment allows.
- For page, component, metadata, image or route changes: also run npm run build, npm run test:dist and npm run test:audit, plus relevant targeted tests and browser visual checks at **375px** and **1280px**.
- Read package.json scripts and active CI before running heavy work. Use actual required checks rather than creating new gates.
- Preserve canonical URL helpers, existing design system boundaries, source record contracts, image-delivery mode and public corrected_at/correction_summary behavior.
- Treat edits to src/content.config.ts, publication fields, slugs, routing semantics, and frontend/backend schemas as coordinated cross-repo work requiring specific evidence.
- Verify PR checks on its **current head SHA**; rebases/merges may create a new head needing new CI. Do not merge because a previous commit passed.
- Check live page after deployment: HTTP/canonical, visible headings, source byline, OG image where changed, article links, sitemap/RSS consistency and responsive behavior. A successful GitHub Actions job alone does not prove rendered correctness.
- For measurement-only tasks, preserve actual GSC property, settled date window, query filters, sample sizes, and unclassified/anonymized data gap.

## Scientific and ethical constraints

- Never fabricate a primary source, DOI, sample size, expert reviewer, quotation, original interview or copyright permission.
- Never transform a paraphrase of a source article into alleged original reporting.
- A preprint does not establish clinical efficacy; a lab model does not prove patient benefit. Keep uncertainty proportional to evidence.
- Do not optimize for a fixed article length or arbitrarily refresh datePublished/dateModified.
- No bought links, fake engagement, keyword stuffing, clickbait, thin page factories, mass unsupervised AI publishing, ad-tracking activation or relaxation of consent protections.
- Log negative experiments and halt tasks that offer negligible improvement at material engineering/editorial cost.

## Definition of done per small iteration

- A clearly bounded evidence-backed change **or** a justified NOT_NEEDED decision.
- Tests or account-action receipt appropriate to the change, and a real deployed smoke check where applicable.
- The original reader benefit preserved and no broken canonical, accessibility, science, image rights or metrics regression.
- Updated ledger with exact PR/commit, URL(s), search-data window and next task.
- No loose “cleanup later” steps needed to make the change safe.

## Starting instruction for the receiving agent

> Read the current main branch and the four docs in docs/products/seo-2026-10. Identify the next ready work package, beginning with SEO-01 unless the ledger already records completion. Independently verify the observation and confirm existing code/issue ownership, execute **one** small meaningful slice end to end, record results and update the ledger in a focused PR. Validate required CI and live behavior. If something cannot be done because of a specific access limitation, report that factual blocker and continue with an unrelated ready item, never inventing completion. Do not reopen #233 or #234 as new SEO initiatives.
