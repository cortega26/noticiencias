# Frontend Architecture

Status: Active and binding  
Authority: Subordinate to `AGENTS.md` and `docs/SOURCE_OF_TRUTH.md`

## Purpose

This document explains the current frontend architecture as it exists in code: responsibilities, dependency direction, data flow, and extension rules.

It is not a redesign proposal.

## System Shape

The frontend is a static publishing surface for Noticiencias. Its core layers are:

- `src/content/posts/`
  - article source files consumed by Astro Content Collections
- `src/content.config.ts`
  - sealed schema for article frontmatter
- `src/pages/`
  - route entrypoints and `getStaticPaths()` owners
- `src/layouts/`
  - page shells and metadata plumbing
- `src/components/ds/`
  - route-agnostic Noticiencias UI primitives
- `src/components/common/`
  - site-specific reusable fragments outside the `ds` layer, including the shell and metadata helpers
- `src/utils/`
  - mostly pure helpers for blog normalization, permalinks, search URLs, filesystem safety, and images
- `src/integration/`
  - the custom bridge that turns `src/config.yaml` into the virtual module `astrowind:config`

## Data Flow

### Publication Flow

1. Humans or the backend publish Markdown into `src/content/posts/`.
2. `src/content.config.ts` validates frontmatter during `astro sync`, `astro check`, and build. A post with `schema_version >= 2` must carry all six editorial enrichment fields (`summary_points`, `glossary`, `fact_check`, `why_it_matters`, `confidence`, `sources`) — this is enforced unconditionally (no permissive/informational mode; there is no environment flag that relaxes it). `scripts/check-editorial-fields.js` mirrors the same rule for the standalone pre-publish gate. The schema also accepts an optional `social` object (`{ publish, id }`) for social-distribution opt-in — the mirror of `SocialConfig` in the backend contract; absent by default, `social: null` rejected on both sides.
3. `src/utils/blog.ts` normalizes collection entries into the local `Post` shape and fails closed on duplicate permalinks.
4. `src/pages/` routes use those normalized posts to build list, taxonomy, series, RSS, and article pages.
5. Layouts pass page metadata into `src/components/common/Metadata.astro`.
6. Astro emits static output into `dist/`.
7. GitHub Actions deploys `dist/` to GitHub Pages and sends a backend callback containing the changed `refinery_id`, originating PR number, and exact post-content hash; the backend uses that evidence to apply the callback to one publication attempt only.

### GitHub Pages deployment and workflow annotations

`.github/workflows/deploy.yml` owns the pre-publication gate, Astro build,
artifact upload, Pages deployment, and post-deployment checks. The deployment
retains the `github-pages` environment for its protection rules without setting
`environment.url`: the GitHub Actions secret-masking heuristic previously
suppressed even the public canonical URL with a "may contain secret" warning.
After verification, the job summary links to `https://noticiencias.com`.
This presentation choice does not change the deployed host or the Pages output
used by the verification and post-publish callback.

Workflows that upload diagnostic artifacts use a commit-SHA-pinned
`actions/upload-artifact@v7.0.2` (Node.js 24). The build reports its active
image-delivery mode as an ordinary log line, not an Actions annotation; the
`github` or `r2` selection is still owned by the existing image delivery
configuration and is not changed here.

### Search Flow

1. `src/pages/search.json.js` reads `getCollection('posts')` during build.
2. It uses `src/utils/build-search-index.ts` to strip Markdown, normalize, build a serialized Lunr index, and emit a versioned artifact `{ version, index, store }` to `/search.json`. Version 2 maps short numeric Lunr references to compact store entries containing canonical URLs. Titles, excerpts, and tags are indexed in full; long article bodies contribute five evenly spaced windows capped at 2,800 characters per article. Full articles remain available at their canonical URLs. The compressed 150 KiB guard remains enforced by `scripts/check-search-budget.js`.
3. `src/pages/buscar.astro` composes `src/components/common/SearchInterface.astro`.
4. `SearchInterface.astro` owns the browser script that fetches the prebuilt serialized Lunr index (plan 039) and deserializes it via `lunr.Index.load()`.
5. `src/utils/search.ts` owns pure search normalization.
6. `src/utils/browser/search-url.ts` owns browser-only URL query synchronization for the search page.

## Responsibility Boundaries

### `src/pages/`

May:

- fetch collections
- call `getStaticPaths()`
- assemble page-specific metadata
- compose layouts and presentational components

Must not:

- become the long-term home for reusable inline browser logic
- normalize malformed content that should have been fixed upstream
- duplicate canonical URL logic from the shared helpers

### `src/layouts/`

May:

- compose page chrome
- forward metadata
- own global document-level wrappers

Must not:

- query collections
- repair content
- duplicate taxonomy or permalink normalization

### `src/components/ds/`

Owns reusable Noticiencias design-system primitives.

Rules:

- route-agnostic
- typed props
- no import from `src/components/template/`

### `src/components/template/` (retired)

Plan 183 moved the last live surfaces into `src/components/common/` and
`src/layouts/`, and deleted `PageLayout`/`LandingLayout`. No files remain. The
freeze guard is intentionally still in place until the superseding ADR (plan
060 §9.5) removes the layer; do not add files under this path.

### `src/components/common/`

Owns site-specific shared fragments that are not Noticiencias design-system primitives,
including the Astrowind-derived shell. The former two-layer structure is retired by
[ADR-0014](adr/0014-retire-two-ui-layers.md): `ds` owns primitives, `common` site
fragments, and `layouts` page chrome; the template paths are gone.

### `src/utils/`

Owns narrow helpers.

Current important files:

- `blog.ts`
- `permalinks.ts`
- `search.ts`
- `src/utils/browser/search-url.ts`
- `images.ts`
- `normalizeImage.ts`
- `safeFs.ts`

`src/utils/utils.ts` is legacy generic surface area and should not be used as the default destination for new unrelated helpers.

## Metadata Contract

The metadata path is:

1. route computes metadata
2. `BaseLayout.astro` or `MarkdownLayout.astro` receives it
3. `src/layouts/Layout.astro` renders document shell
4. `src/components/common/Metadata.astro` emits SEO tags

Canonical URLs should resolve through `getCanonical()` in `src/utils/permalinks.ts` or through metadata that ultimately lands in that shared path.

## URL And Taxonomy Contract

- Canonical site and path prefixes come from `src/config.yaml`.
- Current configured archive bases are:
  - blog: `blog`
  - category: `categorias`
  - tag: `temas`
- Post permalinks currently derive from `/%category%/%slug%` unless a frontmatter `permalink` overrides them.
- Reusable route generation belongs in `src/utils/permalinks.ts` and `src/utils/blog.ts`.
- `/llm-md/*` (`src/pages/llm-md/[...slug].md.ts`) is a build-time backing
  artifact namespace for Accept-based Markdown negotiation (see
  `docs/adr/0008-markdown-for-agents.md`) — one static Markdown file per
  `schema_version >= 2` article, at the same path as its canonical
  permalink. It is not a second canonical URL: excluded from the sitemap
  (`astro.config.mjs`'s `sitemap.filter`) and disallowed in
  `public/robots.txt`. The Cloudflare Worker in `workers/` fetches it
  internally when a request's `Accept` header prefers `text/markdown`.
- `/social-manifest.json` (`src/pages/social-manifest.json.ts`) is a
  build-time operational snapshot of every article route with its normalized
  `social` opt-in and canonical URL, plus build provenance (non-null only
  inside the `Deploy to GitHub Pages` workflow). Consumed by the
  social-distribution publisher, not by the site. Also excluded from the
  sitemap (`astro.config.mjs`'s `sitemap.filter` — `@astrojs/sitemap` does
  emit JSON endpoint routes); `scripts/dist-sanity.js` asserts the manifest
  matches the built routes and stays out of the sitemap.
- Social publishing (`scripts/social/publish.js`, admin CLI
  `scripts/social/operate.js`, Buffer adapter
  `scripts/social/providers/buffer.js`, Bluesky adapter
  `scripts/social/providers/bluesky.js`) runs from
  `.github/workflows/social-distribution.yml`, which is disabled by default:
  every trigger runs the read-only dry-run job, and the publish job only runs
  when the `SOCIAL_PUBLISH_ENABLED` repository variable is `'true'`.
  Publisher state lives in the state.json file on the social-state branch,
  never in src/content/posts/.

## Browser-Side Behavior

The frontend is not a client-heavy app, but it does have controlled browser behavior:

- `ClientRouter` view transitions in `src/layouts/Layout.astro`
- theme and common template scripts
- search UI in `src/components/common/SearchInterface.astro`

Rules:

- keep browser code local to the owning page or component
- do not move DOM code into generic `src/utils/` modules unless the module is explicitly browser-only and has real reuse
- treat Astro page transitions as the default navigation model when writing scripts

## Known Compatibility Debt

These behaviors exist today and are allowed only as documented compatibility:

- `src/layouts/PostLayout.astro` contains defensive title cleanup for malformed legacy title strings. Do not expand that pattern; fix content or the publishing contract instead.
- `src/pages/search.json.js` contains local fallback permalink logic when `data.permalink` is absent. Shared permalink generation should remain the target direction.
- `src/layouts/PostLayout.astro` emits JSON-LD with `set:html` for structured data. That is acceptable because the payload is locally constructed, not raw frontmatter HTML.

## Extension Rules

- New article-facing UI should prefer `ds` or `common` unless it is clearly part of the Astrowind shell.
- New route families should keep pathname ownership in `src/config.yaml` and URL generation in shared helpers.
- New validation or content-policy behavior should live close to schema or content checks, not in rendering components.
- If a change affects `src/content.config.ts`, `src/config.yaml`, or permalink generation, treat it as a cross-repo contract change with the backend.
