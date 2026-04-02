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
- `src/content/config.ts`
  - sealed schema for article frontmatter
- `src/pages/`
  - route entrypoints and `getStaticPaths()` owners
- `src/layouts/`
  - page shells and metadata plumbing
- `src/components/ds/`
  - route-agnostic Noticiencias UI primitives
- `src/components/template/`
  - Astrowind-derived shell, widgets, and blog-facing template components
- `src/components/common/`
  - site-specific reusable fragments outside the `ds` or `template` layers
- `src/utils/`
  - mostly pure helpers for blog normalization, permalinks, search URLs, filesystem safety, and images
- `src/integration/`
  - the custom bridge that turns `src/config.yaml` into the virtual module `astrowind:config`

## Data Flow

### Publication Flow

1. Humans or the backend publish Markdown into `src/content/posts/`.
2. `src/content/config.ts` validates frontmatter during `astro sync`, `astro check`, and build.
3. `src/utils/blog.ts` normalizes collection entries into the local `Post` shape and fails closed on duplicate permalinks.
4. `src/pages/` routes use those normalized posts to build list, taxonomy, series, RSS, and article pages.
5. Layouts pass page metadata into `src/components/template/common/Metadata.astro`.
6. Astro emits static output into `dist/`.
7. GitHub Actions deploys `dist/` to GitHub Pages.

### Search Flow

1. `src/pages/search.json.js` reads `getCollection('posts')` during build.
2. It emits a JSON document index to `/search.json`.
3. `src/pages/buscar.astro` loads that index in the browser and builds a Lunr index client-side.
4. `src/utils/search-url.ts` owns URL query synchronization for the search page.

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

### `src/components/template/`

Owns the site shell and legacy Astrowind-derived composition layer.

Rules:

- may compose `ds` components
- may own small browser helpers tied to template behavior
- must not become a generic dumping ground for arbitrary app logic

### `src/utils/`

Owns narrow helpers.

Current important files:

- `blog.ts`
- `permalinks.ts`
- `search-url.ts`
- `images.ts`
- `normalizeImage.ts`
- `safeFs.ts`

`src/utils/utils.ts` is legacy generic surface area and should not be used as the default destination for new unrelated helpers.

## Metadata Contract

The metadata path is:

1. route computes metadata
2. `BaseLayout.astro` or template layout receives it
3. `src/layouts/template/Layout.astro` renders document shell
4. `src/components/template/common/Metadata.astro` emits SEO tags

Canonical URLs should resolve through `getCanonical()` in `src/utils/permalinks.ts` or through metadata that ultimately lands in that shared path.

## URL And Taxonomy Contract

- Canonical site and path prefixes come from `src/config.yaml`.
- Current configured archive bases are:
  - blog: `blog`
  - category: `categorias`
  - tag: `temas`
- Post permalinks currently derive from `/%category%/%slug%` unless a frontmatter `permalink` overrides them.
- Reusable route generation belongs in `src/utils/permalinks.ts` and `src/utils/blog.ts`.

## Browser-Side Behavior

The frontend is not a client-heavy app, but it does have controlled browser behavior:

- `ClientRouter` view transitions in `src/layouts/template/Layout.astro`
- theme and common template scripts
- search UI in `src/pages/buscar.astro`

Rules:

- keep browser code local to the owning page or component
- do not move DOM code into generic `src/utils/` modules unless the module is explicitly browser-only and has real reuse
- treat Astro page transitions as the default navigation model when writing scripts

## Known Compatibility Debt

These behaviors exist today and are allowed only as documented compatibility:

- `src/components/template/PostLayout.astro` contains defensive title cleanup for malformed legacy title strings. Do not expand that pattern; fix content or the publishing contract instead.
- `src/pages/search.json.js` contains local fallback permalink logic when `data.permalink` is absent. Shared permalink generation should remain the target direction.
- `src/components/template/PostLayout.astro` emits JSON-LD with `set:html` for structured data. That is acceptable because the payload is locally constructed, not raw frontmatter HTML.

## Extension Rules

- New article-facing UI should prefer `ds` or `common` unless it is clearly part of the Astrowind shell.
- New route families should keep pathname ownership in `src/config.yaml` and URL generation in shared helpers.
- New validation or content-policy behavior should live close to schema or content checks, not in rendering components.
- If a change affects `src/content/config.ts`, `src/config.yaml`, or permalink generation, treat it as a cross-repo contract change with the backend.
