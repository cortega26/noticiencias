# ADR-0008: Markdown for Agents — hybrid build-time artifact + negotiation-only Worker

**Status:** Implemented.

## Context and goal

Make Noticiencias' public editorial content (articles, and eventually
category/tag/institutional pages) cleanly readable by AI agents, research
assistants, and answer engines that explicitly request a Markdown
representation via `Accept: text/markdown`, without changing anything for
normal browsers and without introducing runtime infrastructure the site
doesn't already have a reason to run.

This ADR is scoped to **articles only** for the initial implementation
(the pattern extends to other page types later, once proven).

## Recon (code-verified, this session)

**Hosting is fully static.** `astro.config.mjs` has no `output`/`adapter`
key — Astro defaults to `output: 'static'`. The site deploys via
`.github/workflows/deploy.yml` to GitHub Pages
(`actions/deploy-pages`/`actions/configure-pages`). There is no SSR, no
server, nothing that runs at request time on the Astro side.

**Cloudflare already sits in front of the zone, but only intercepts
`/api/*`.** `workers/wrangler.toml`'s `routes` is
`{ pattern = "noticiencias.com/api/*", zone_name = "noticiencias.com" }`,
with an explicit comment: "All other requests pass through to GitHub
Pages." `workers/src/index.ts` is a single `fetch()` handler with a manual
if-chain (no router library) dispatching `/api/report`, `/api/health`,
`/api/status`, and an OPTIONS/CORS branch; anything else falls through to
`return new Response('Not Found', { status: 404 })` — but per the file's
own comment, that branch "should not be reached if route pattern is
correct," because Cloudflare's zone-level route config decides whether the
Worker is invoked _at all_. Adding a new route pattern for article paths
means this `fetch()` handler will now run on every matching request,
including ordinary human visits — today it never does.

**Cloudflare's Free plan does not include the native "Markdown for
Agents" zone feature** (verified against
`developers.cloudflare.com/fundamentals/reference/markdown-for-agents/`:
"available to Pro, Business and Enterprise plans... at no cost" — Free is
not listed). The zero-code toggle is off the table; a Worker is required.

**Cache-key correctness does not require a bespoke Worker Cache API setup
for this design**, and the alternative — customizing the cache key by
request header — is Enterprise-only anyway (verified against
`developers.cloudflare.com/cache/how-to/cache-keys/`: header-based cache
key customization is "No" on Free through Business, "Enterprise" only). A
Worker's own `caches.default` API _can_ use an arbitrary custom
`Request` as a cache key on any plan (verified against
`developers.cloudflare.com/workers/runtime-apis/cache/`), but the hybrid
design below sidesteps the question entirely: if the Markdown artifact is
a real static file at its own URL, it is cached by Cloudflare's ordinary
per-URL cache exactly like any other static asset, with no header
involved. The Worker's own response is the only thing that would need
special cache handling, and per the explicit design decision below, it
simply isn't cached at all — see "Caching (explicitly out of scope)".

**Cloudflare has no platform-level fail-open setting.** Verified against
`developers.cloudflare.com/workers/observability/errors/`: there is no
route- or `wrangler.toml`-level configuration that falls back to origin on
an uncaught exception. The one real platform mechanism is
**`ctx.passThroughOnException()`**, called from inside the `fetch()`
handler — "a Workers application can forward requests to your origin if
an exception is thrown during the Worker's execution," after that call is
made. It must still be called explicitly in code; nothing about it is
declarative, and it is **narrower than "platform-level fail-open" might
suggest**: it only catches a genuinely _uncaught_ exception propagating out
of the handler — it does nothing for a bug that returns a malformed
response, hangs, or degrades without throwing, and it does not run until
the exception actually escapes (i.e. it is not a substitute for handling
expected failure modes explicitly). The **primary** fail-open mechanism
in this design is the explicit `try/catch` around the Markdown-specific
code path in Design §3, which deliberately falls back to a normal HTML
fetch on any error it can name. `ctx.passThroughOnException()` is a
supplementary, outermost safety net for whatever that `try/catch` didn't
anticipate — not the main line of defense.

**There is already a near-complete precedent for the exact serialization
this feature needs.** `src/pages/llms-full.txt.ts:77-143` already builds,
per post, a Markdown block from: canonical URL, publish date, author,
category, tags, excerpt, confidence, translation method, investigation
flag, source URL, `summary_points`, `why_it_matters`, `sources`,
`glossary`, `uncertainty_note`, and the raw MDX body (`postBodyMap`, keyed
off `getCollection('posts')`'s raw `.body`, not the rendered `Content`
component). It deliberately does **not** include `refinery_id`,
`review_status`, `editorial_score`, or `requires_uncertainty_note` — this
is already a vetted, shipping precedent for what's public-safe, not
something this ADR has to re-derive from scratch. It is missing
`fact_check` (the six-field v2 contract's own fact-verification field),
which this feature's own Design §1 should add, extending the existing
precedent rather than diverging from it. **The right implementation move
is to extract this per-post serialization block into a shared function**
(e.g. `src/utils/markdownArticle.ts`) used by both `llms-full.txt.ts`
(unchanged output) and the new per-article artifact, rather than writing
a second, parallel serializer.

**The canonical per-post data source is `getNormalizedPost` in
`src/utils/blog.ts:64-172`**, exposed via `fetchPosts()`. It is the same
object `PostLayout.astro` renders from, but it is _not_ filtered for
public safety — it returns `refinery_id`, `review_status`,
`translation_method`, and `editorial_score` on the same object as
`summary_points`/`sources`/etc. Building the Markdown artifact from an
unfiltered spread of this object would violate the operator's explicit
constraint #4 below; the shared serializer must be an explicit allowlist,
matching `llms-full.txt.ts`'s existing precedent, not a passthrough.

**Content schema** (`src/content.config.ts:5-79`): `schema_version >= 2`
is the eligibility gate already used elsewhere in this codebase (Phase
2b/2c, backend repo) to mean "carries the six-field editorial enrichment
contract" (`summary_points`, `glossary`, `fact_check`, `why_it_matters`,
`confidence`, `sources` — all validated present by the same file's
`superRefine`, lines ~79+). `schema_version: 1` posts do not reliably have
these fields. Eligibility for a Markdown artifact should follow this same
gate, not a new one.

**Permalinks are not flat.** `src/utils/permalinks.ts`'s `POST_PERMALINK_PATTERN`
supports `%category%`/`%year%`/etc. substitution, and
`resolvePostPermalink` (`src/utils/blog.ts:51-59`) actually resolves each
post to a real path (e.g. `<category>/<slug>` or a raw override via
frontmatter `permalink`). Article URLs are not guaranteed to sit at a
predictable single-segment path — a naive `<slug>.md` scheme risks
colliding with an unrelated top-level route. See Design §2.

**Existing AI/crawler policy is deliberate and must be preserved for real
article URLs — but the new backing namespace is a different case.**
`public/robots.txt` explicitly allows retrieval/answer engines
(`PerplexityBot`, `OAI-SearchBot`, `Google-Extended`) and explicitly
disallows training crawlers (`GPTBot`, `ClaudeBot`, `cohere-ai`,
`Omgilibot`, `facebookexternalhit`) **for canonical content URLs**.
Content negotiation via `Accept: text/markdown` on those URLs is a
_retrieval-time_ mechanism for a client that already decided to fetch a
specific URL — it does not change who is _allowed_ to crawl the article
itself, and that existing policy is unchanged by this feature.

`/llm-md/*`, however, is an **implementation backing namespace**, not
a second piece of public content — it exists only so the Worker has
something to fetch internally (Design §2/§3), and per operator constraint
#2 must never become a second, independently-discoverable/indexable
surface for the same article. A crawler that discovers and indexes
`/llm-md/*` directly (rather than reaching the Markdown representation
through negotiation on the real URL) would create exactly the duplicate-
content situation constraint #2 warns against, and would let a
training-disallowed bot potentially reach the same content via a URL
`robots.txt` never told it about. `robots.txt` gets one new rule —
`Disallow: /llm-md/` — added without touching any existing
`User-agent` block's treatment of real content. No `Content-Signal` header
exists in this codebase today (grep confirmed zero hits) and this feature
does not introduce one.

**`llms.txt`/`llms-full.txt` are the existing "agent discovery" mechanism**
(`src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts`) — a _different_
concern from content negotiation, per the operator's own framing
upstream. Out of scope for this ADR to modify, beyond reusing the shared
serializer function once it exists (optional follow-up, not required for
Definition of Done).

## Operator decisions (this session)

The operator gave four hard constraints, binding on the implementation:

1. **Correct `Accept` negotiation, no substring check.** Parse media
   types and q-values per RFC 9110 §12.5.1 semantics (or a well-tested
   existing parser — see STOP conditions). `*/*` and an ordinary browser's
   `Accept: text/html,application/xhtml+xml,...` must resolve to HTML.
   Only a request that actually prefers `text/markdown` over `text/html`
   (by explicit type or a strictly higher q-value) gets the Markdown
   response.
2. **Separated artifact namespace; the Worker's internal fetch must not
   be able to recurse through the negotiation path.** The prebuilt
   Markdown file must live at a URL the negotiation logic itself would
   never intercept, and must not become a second public canonical URL for
   the same content (duplicate-content/SEO risk). See Design §2 for the
   chosen namespace and why.
3. **Fail open at both levels — explicit `try/catch` is primary, the
   platform mechanism is a supplementary net, not the guarantee.** Any
   error in the Markdown-specific code path falls back to serving the
   original HTML (fetched from origin) — never an error page, never a
   broken partial response, since this is an optional representation
   layer, not a security boundary. `ctx.passThroughOnException()` is
   still called, as an outermost backstop for whatever the explicit
   `try/catch` didn't anticipate — but it is narrower than "platform-level
   fail-open" might suggest (see Recon above): it only fires on a
   genuinely uncaught exception, not on a bug that degrades silently. The
   named, testable behavior this ADR commits to is the `try/catch`
   fallback; `passThroughOnException()` is defense in depth on top of it,
   not a replacement for it.
4. **Public-safe content only, and `fact_check` is explicitly in scope,
   not excluded.** The Markdown body is generated from canonical article
   content plus explicitly the six enrichment fields (`summary_points`,
   `glossary`, `fact_check`, `why_it_matters`, `confidence`, `sources`)
   plus canonical/publication metadata (title, canonical URL,
   publish/update date, author, category, tags). `fact_check` is
   mandatory for every `schema_version >= 2` post and is already rendered
   publicly on the HTML page via `TrustPanel.astro` (confirmed:
   `src/components/common/TrustPanel.astro:13,23,42,103-105` accepts and
   renders a `factCheck` prop) — including it in the Markdown artifact
   exposes nothing that isn't already public, it just mirrors existing
   public content into the new representation. No raw or internal
   frontmatter (`refinery_id`, `review_status`, `translation_method`,
   `editorial_score`, `requires_uncertainty_note`, `investigation`,
   `featured`/`featured_rank`) — even though some of these already appear
   in `llms-full.txt.ts`'s existing output, this feature's own allowlist
   is the six fields plus the metadata named here, not a copy of that
   file's exact field list.
   `llms-full.txt.ts` currently omits `fact_check` — checked its full git
   history (`git log -p --follow`): the file has exactly one commit,
   `02fde42` ("implement spec-compliant llms.txt and llms-full.txt
   endpoints"), and `fact_check` never appears in that diff or in any
   code comment in the file today. There is no documented reason for the
   omission; it reads as an oversight, not a deliberate exclusion, since
   every other five-sixths of the same enrichment contract is already
   included there. The shared serializer
   (Design §1) includes `fact_check`, and `llms-full.txt.ts` is updated to
   use the shared serializer as-is — this is a deliberate, in-scope fix to
   that file's own consistency, not an accidental behavior change smuggled
   in by the refactor.

Additionally, the operator explicitly ruled out for this initial
implementation: Worker Cache API logic, custom cache keys, runtime
HTML→Markdown conversion, KV/R2 persistence, or any new caching
infrastructure. Static backing resources stay independently cacheable by
URL, exactly like every other static asset on the site today. Negotiated-
response caching is a later optimization, only if real evidence (traffic,
latency data) justifies it — not a day-one assumption.

## Design

### 1. Shared Markdown serializer (build-time, Astro-side)

New module, e.g. `src/utils/markdownArticle.ts`, exporting a function
`renderArticleMarkdown(post: Post, rawBody: string): string` that produces
the article's public Markdown body: title, canonical URL, publish/update
date, author, category, tags, `summary_points`, `glossary`, `fact_check`,
`why_it_matters`, `confidence`, `sources`, then the raw MDX/Markdown body
(same `postBodyMap` pattern `llms-full.txt.ts:32,79` already uses — the
_source_ body, not Astro's rendered `Content` component, avoiding any HTML
round-trip per the operator's "no runtime HTML→Markdown conversion"
constraint). Extract this from `llms-full.txt.ts`'s existing per-post
block (lines 77-143) rather than writing new logic from scratch; update
`llms-full.txt.ts` to call the shared function (its own output should be
unchanged except for `fact_check` now being included, matching this
feature's allowlist — confirm with the operator if that specific output
change is acceptable, since `llms-full.txt.ts` currently omits it
deliberately or by oversight; STOP and ask if unclear which).

Eligibility: only `schema_version >= 2` posts (matching the same gate
`content.config.ts` already enforces for the six-field contract) get a
Markdown artifact. A `schema_version: 1` post has no Markdown counterpart
— the negotiation Worker's fallback for those is a plain HTML passthrough
regardless of `Accept` (see Design §3).

### 2. Static artifact namespace (build-time output location)

Do **not** append `.md` to the existing permalink path (e.g. turning
`/ciencia/some-slug/` into `/ciencia/some-slug/.md` or
`/ciencia/some-slug.md`) — this risks colliding with the permalink's own
`%category%`/nested-segment structure and, more importantly, creates a
second URL that search engines and other clients could index as a
duplicate of the canonical article, which the operator's constraint #2
explicitly warns against.

Use a **dedicated, non-content top-level namespace** the negotiation
Worker route excludes from its own interception — `/llm-md/<same
permalink path>.md` (a literal new Astro static endpoint pattern, one
per eligible post, generated via `getStaticPaths()` the same way
`[...slug].astro` does).

**Implementation finding:** the namespace must not start with an
underscore. Astro treats any `_`-prefixed path or file under `src/pages/`
as private and never routes it — confirmed empirically: an initial
`src/pages/_markdown/[...slug].md.ts` built successfully with no errors
but produced zero output files, silently. Renaming the directory (no
other change) made the exact same 19 eligible artifacts appear in
`dist/`. `/llm-md/` was chosen instead, consistent with the existing
`llms.txt`/`llms-full.txt` naming for agent-facing surfaces.

This namespace:

- Cannot collide with any real content route, since nothing in this
  codebase's URL scheme currently produces `/llm-md/*`.
- Is trivially excludable from the Worker's negotiation route pattern
  (the route must never intercept `/llm-md/*` itself — see Design §3 —
  which is what makes "the Worker's internal fetch cannot recurse through
  the negotiation path" true by construction, not by a runtime check).
- Is never linked from the human-facing site and is not the canonical URL
  for anything — `getCanonical()` / structured data / sitemap continue to
  reference only the real article URL, unchanged. Confirm at
  implementation time whether `@astrojs/sitemap`'s `filter` (currently
  excluding `/buscar`, `/search.json`, `/admin/` —
  `astro.config.mjs:17-20`) needs a new exclusion for `/llm-md/*` so it
  never appears in the sitemap as a second indexable URL for the same
  content — almost certainly yes; treat this as part of Design §2, not an
  afterthought.
- Add `Disallow: /llm-md/` to `public/robots.txt`, without touching
  any existing `User-agent` block. This is a backing implementation
  namespace, not public content in its own right — it should not be
  independently crawlable or indexable at all, regardless of a given
  bot's search-vs-training classification for real article URLs (see
  Recon above).

### 3. Negotiation-only Worker route

**Resolved (was a STOP condition):** confirmed via `resolvePostPermalink`
(`src/utils/blog.ts:51-62`) that article permalinks have no fixed prefix —
`generatePermalink()` builds from `POST_PERMALINK_PATTERN =
'/%category%/%slug%'` (`src/config.yaml:46`), but when a post has no
category the `%category%` segment is empty and gets filtered out
(`src/utils/permalinks.ts` `.filter((el) => !!el)`), producing a
**bare root-level slug** (e.g. `/2026-01-15-cursos-en-linea-...`). 16 of
31 current posts resolve this way; the rest resolve to `/<category>/<slug>`
(e.g. `/ciencia/2026-01-17-...`). Since `[...slug].astro` is a catch-all at
the site root with no reserved segment, there is no route pattern that
matches "article paths" without also matching (or risking collision with)
other top-level static pages.

**Operator decision:** broaden the Worker's route from
`noticiencias.com/api/*` to `noticiencias.com/*` (confirmed — the
alternative, keeping narrow prefix-based routes, would silently exclude
every bare-slug article, currently over half the corpus, from
negotiation). This means the Worker is now invoked for every request to
the zone, including static assets, before Cloudflare's edge cache —
accepted tradeoff for Free-tier request-quota/latency in exchange for
correct coverage. The fetch handler must keep the non-negotiated path
(no `Accept: text/markdown`, or non-post paths) to a single cheap
`fetch(request)` passthrough so the added per-request cost stays minimal.
The `/llm-md/*` recursion guard (below) is applied first and
unconditionally, regardless of route breadth, so the guard is true by
construction rather than by assuming same-Worker subrequest semantics.

**Pre-commit operational audit (route invocation scope):** because
Cloudflare route matching decides Worker invocation before any code
runs, `noticiencias.com/*` means _every_ request to the zone now invokes
this Worker — HTML, `/_astro/*` JS/CSS, images, fonts, `robots.txt`,
sitemap, RSS, `search.json`, everything — confirmed by how Cloudflare
routing works (there is no way for a request matching the route to skip
the Worker), not assumed. Checked whether to structurally exclude
high-volume static namespaces at the routing layer instead of inside the
Worker: Cloudflare _does_ support this — "a route can be specified
without being associated with a Worker… this will act to negate any less
specific patterns" — but only as a zone-level route object created
out-of-band (dashboard/API), not as `wrangler.toml` syntax; `wrangler.toml`'s
`routes` array can only ever assign a pattern _to_ this Worker, never
exclude one (verified against Wrangler's own configuration docs). Adding
such an exclusion would mean a second, unversioned point of
configuration this repo's `wrangler.toml` can't express or review —
exactly the "brittle configuration" this design otherwise avoids.
Given the site has no confirmed production traffic yet (GA4/Search
Console are not configured — see the growth-plan memory), Free plan's
100,000 Worker-invocations/day budget (confirmed against Cloudflare's
pricing docs: "only requests that hit a Worker count against your
limits"), and that this site ships no client-side JS islands (`ds` →
`template` → `pages`, server-first, per `AGENTS.md`) so a pageview's
realistic amplification is on the order of ~5-15 requests (HTML + a
couple of CSS/JS chunks + a hero image), not dozens — this is headroom
in the thousands of pageviews/day even under conservative assumptions.
**Decision: no routing exclusion added.** Revisit only if real traffic
data (once GA4/GSC are wired up) shows this materially matters, at which
point the dashboard-level unassigned-route mechanism above is the
correct lever, not a code-level path check (which wouldn't reduce
invocation count at all — only CPU, which is nowhere near the 10ms/invocation
Free-tier ceiling for this simple logic either way).

In `workers/src/index.ts`, following the existing manual if-chain
convention (no new router dependency):

```
if (pathname.startsWith('/llm-md/')) {
  return fetch(request); // recursion guard: never re-enter negotiation
}

ctx.passThroughOnException(); // supplementary platform-level net (uncaught exceptions only)
try {
  if (prefersMarkdown(request.headers.get('Accept'))) {
    const mdUrl = toMarkdownArtifactUrl(url); // -> /llm-md/<path>.md
    const mdResponse = await fetch(mdUrl);
    if (mdResponse.ok) {
      const response = new Response(mdResponse.body, mdResponse);
      response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
      addVaryAccept(response.headers); // merges, never overwrites — see below
      return response;
    }
    // artifact missing (non-post path, v1 post, or not yet built) — fall through to HTML
  }
} catch {
  // explicit application-level fail-open (primary defense) — never surface an error to the client
}

const originResponse = await fetch(request);

// Only the HTML representation actually varies by Accept (it has a
// Markdown counterpart) — non-HTML assets never do, so they pass through
// completely untouched. See "Vary: Accept scope" audit below.
if (!(originResponse.headers.get('Content-Type') ?? '').includes('text/html')) {
  return originResponse;
}
const response = new Response(originResponse.body, originResponse);
addVaryAccept(response.headers);
return response;
```

**`Vary: Accept` scope (pre-commit operational audit, corrected before
deploy):** the first implementation added `Vary: Accept` to _every_
passthrough response — including images, CSS, JS, RSS, sitemap, and
JSON, none of which vary by Accept — and did so via
`headers.set('Vary', 'Accept')`, which **overwrites** rather than merges.
A live `curl -I` against production (`noticiencias.com/robots.txt` and
the site's 404 page) confirmed GitHub Pages' Fastly CDN already sends
`Vary: Accept-Encoding` on every response; the original code would have
silently destroyed that header on deploy — a real regression, not a
hypothetical one. Fixed with two changes: (1) the Content-Type check
above scopes `Vary: Accept` to actual HTML responses only; (2) a small
`addVaryAccept()` helper appends `Accept` to whatever `Vary` value
already exists (case-insensitively de-duplicated) instead of replacing
it, applied identically on both the Markdown branch and the HTML
passthrough. Verified by test (`workers/tests/markdown-negotiation.test.ts`):
an HTML response with `Vary: Accept-Encoding` ends up with
`Vary: Accept-Encoding, Accept`; a CSS response's `Vary: Accept-Encoding`
and `Content-Type` are left byte-for-byte untouched.

`prefersMarkdown()` must implement real `Accept` parsing (media type +
q-value comparison per operator constraint #1) — do not write a
`headers.get('Accept')?.includes('text/markdown')` substring check. Verify
at implementation time whether an existing, small, dependency-free parser
is warranted or whether a minimal RFC-9110-correct implementation belongs
in `workers/src/utils/` alongside the existing `rateLimit.ts`/`validate.ts`
utilities (matching this codebase's own convention of small focused
utility modules, not a new external dependency, per the operator's
"no unnecessary infrastructure" framing upstream).

### 4. Caching (explicitly out of scope for this implementation)

No Worker Cache API usage, no custom cache key, no KV/R2 involvement. The
`/llm-md/*.md` static files are ordinary GitHub Pages static assets and
are cached by Cloudflare's default per-URL cache exactly like any other
static file on the site today — no special configuration needed, because
each representation (HTML at its real URL, Markdown at its
`/llm-md/*` URL) is a distinct, independently-cacheable object. The
Worker's own response (the thing actually returned to the client at the
canonical article URL) is not written into any cache by this
implementation — every request re-runs the cheap header check plus one
internal fetch of an already-cached static asset. If traffic/latency data
later justifies caching the Worker's negotiated response itself, that is
a distinct, separately-evaluated follow-up, not part of this work.

## Scope boundaries

**In scope:** the shared Markdown serializer, per-article static artifact
generation for `schema_version >= 2` posts, the new Worker route with
real `Accept` negotiation and fail-open behavior at both the application
and platform level, sitemap exclusion for the new namespace, a
`Disallow: /llm-md/` rule in `robots.txt` (scoped only to that backing
namespace, no other `robots.txt` rule touched), tests for the negotiation
logic and the serializer's public-safety allowlist.

**Out of scope:** category/tag/homepage/institutional-page Markdown
artifacts (article-only for this round); runtime HTML→Markdown conversion
of any kind; any Worker caching infrastructure; any change to
`robots.txt`'s existing rules for real content URLs (only the one new
`/llm-md/` rule is added); any `Content-Signal` header; changes to
`llms.txt`/`llms-full.txt` beyond reusing the extracted shared serializer
(which now includes `fact_check` — see Design §1); upgrading the
Cloudflare plan.

## STOP conditions (all resolved during implementation)

**Resolved:** the `Accept` q-value parser. No existing dependency-free
parser was found in `workers/`'s own dependencies; a minimal hand-written
one (`workers/src/utils/accept.ts`) stayed well within "non-trivial"
territory — media-type + q-value only, no accept-params beyond `q`,
~70 lines, 100% statement / 97% branch coverage (`workers/tests/accept.test.ts`,
13 cases covering RFC edge cases: malformed q, trailing commas, malformed
media types, wildcards, q-value ties). No stop was warranted.

**Resolved (corrected during a pre-commit operational audit):** whether
to copy "other body-independent headers" from the origin's response onto
the Markdown response. `public/_headers`'s own comment ("GitHub Pages
does not process `_headers` files") is true but was read too broadly at
first — it only rules out headers this _repo_ would configure. A live
`curl -I` against production revealed GitHub Pages' actual Fastly CDN
sends `Vary: Accept-Encoding` on every response (confirmed on both
`/robots.txt` and the site's own 404 page), which this repo does not
control and which is real, meaningful, and was initially being destroyed
outright by `headers.set('Vary', 'Accept')` — a genuine regression caught
before deploy, not a hypothetical one. Fixed: both the Markdown branch
and the HTML passthrough now build their response headers from the
origin response object (`new Response(originResponse.body,
originResponse)`) and merge `Accept` into any existing `Vary` value via a
small `addVaryAccept()` helper, rather than constructing headers from
scratch or overwriting what's there. `Content-Type` is still set
explicitly (the only header that must change). See `workers/src/index.ts`
and the "Vary: Accept scope" audit below for the rest of this correction.

## Done criteria

- [x] A normal browser request (no `Accept: text/markdown` preference)
      returns the existing HTML, unchanged, for every article.
- [x] `Accept: text/markdown` on an eligible (`schema_version >= 2`)
      article returns a Markdown body with
      `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`,
      containing title, canonical URL, dates, author, the six enrichment
      fields, and the article body.
- [x] `Accept: text/markdown` on an ineligible (`schema_version: 1`)
      article, or any path the artifact doesn't exist for, falls back to
      HTML — never an error.
- [x] Real `Accept` q-value negotiation is proven by test: `*/*` → HTML;
      `text/markdown, text/html;q=0.9` → Markdown; ordinary browser
      `Accept` header → HTML.
- [x] The `/llm-md/*` namespace is excluded from the sitemap and never
      appears as a second canonical URL anywhere (structured data, OG
      tags, `getCanonical()` output) for the same article.
- [x] A thrown exception anywhere in the negotiation/serialization path
      results in the ordinary HTML response reaching the client, verified
      by a test that deliberately forces a failure.
- [x] No new runtime infrastructure (Worker Cache API, KV, R2) was
      introduced for this feature.
- [x] `robots.txt`'s existing rules for real content URLs (the
      training-vs-retrieval split) are unchanged; the only new rule is
      `Disallow: /llm-md/`. No `Content-Signal` header is introduced.
- [x] `fact_check` appears in both the new per-article Markdown artifact
      and `llms-full.txt`'s output (fixed via the shared serializer, not
      two separate edits).
- [x] `Vary: Accept` is added only to actual HTML/Markdown
      representations, merged with (never overwriting) any `Vary` value
      the origin already sends — verified against GitHub Pages' real
      `Vary: Accept-Encoding` via live `curl` and by test.
