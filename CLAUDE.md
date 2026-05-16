# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Astro dev server
npm run build        # Full build (image derivatives + astro build)
npm run preview      # Preview production build
npm run lint         # Frontmatter checks + prettier check + eslint
npm run lint-fix     # Prettier write + eslint --fix
npm run validate:content  # Full content validation (dates, images, sidecars, tags, astro check, freeze)
npm run test:audit   # Run all Vitest tests (tests/**/*.test.ts)
npm run test:coverage # Vitest with coverage
npm run test:dist    # Sanity check on dist/ output
npm run test:deploy -- <url>  # Post-deployment smoke tests
npm run publish:image-derivatives  # Scan images, update manifest, upload AVIF to R2
npm run format       # Prettier write
npm run check:contract-sync  # Validate content schema matches backend contract
```

## Architecture

Static Astro 6 site with MDX content, deployed to GitHub Pages. Server-first rendering — no React/component islands.

### Key directories

- `src/content/posts/` — Article source files (MD/MDX). Published by backend `noticiencias_news_collector`.
- `src/content/config.ts` — **Sealed** Zod schema for the `posts` collection. Cross-repo contract with backend.
- `src/config.yaml` — Site metadata, blog config, URL pathnames, analytics, UI theme. Exposed via `astrowind:config`.
- `src/pages/` — Route entrypoints and `getStaticPaths()`. Blog list, categories (`categorias/`), tags (`temas/`), search, series, article pages.
- `src/layouts/` — Page shells and metadata plumbing. `BaseLayout.astro` and `PostLayout.astro` are primary.
- `src/components/ds/` — Noticiencias design-system primitives (atoms/molecules/organisms). Route-agnostic, typed props.
- `src/components/template/` — Astrowind-derived site shell, widgets, header/footer, blog grid/sidebar.
- `src/components/common/` — Site-specific fragments (BetaBanner, Newsletter, WhyTrustUs).
- `src/utils/` — Pure helpers: `blog.ts` (post normalization), `permalinks.ts`, `search-url.ts`, `images.ts`.
- `src/integration/` — Custom Astro integration that exposes `src/config.yaml` as virtual module `astrowind:config`.
- `tests/` — Vitest test files covering search, slugs, site integrity, images, content quality, compliance.
- `scripts/` — Node.js scripts for content validation, image derivatives, deploy checks, audits.

### Data flow

1. Backend publishes Markdown into `src/content/posts/`
2. `src/content/config.ts` validates frontmatter at build time
3. `src/utils/blog.ts` normalizes collection entries into `Post` shape
4. Pages consume normalized posts to build list, taxonomy, series, RSS, article pages
5. Layouts forward metadata to `src/components/template/common/Metadata.astro` for SEO tags
6. Astro emits static output to `dist/`
7. GitHub Actions deploys `dist/` to GitHub Pages

### URL structure

- Blog: `/blog/` → `src/pages/blog/[...page].astro`
- Categories: `/categorias/[category]/` → `src/pages/categorias/[category]/[...page].astro`
- Tags: `/temas/[tag]/` → `src/pages/temas/[tag]/[...page].astro`
- Articles: `/%category%/%slug%/` (or override via frontmatter `permalink`)
- Search: `/buscar` → build-time JSON index + Lunr client-side

### Image pipeline

Hero images use a derivative manifest at `data/image-derivatives-manifest.json`. The `publish:image-derivatives` script generates AVIF variants and uploads to Cloudflare R2. Without R2 env vars, falls back to Astro image optimization. CI can enforce CDN URLs via `IMAGE_DERIVATIVES_REQUIRE_URL=1`.

## Governance

**Must-read documents:**

- `AGENTS.md` — Binding engineering governance and change laws for AI agents.
- `docs/ARCHITECTURE.md` — Module boundaries, data flow, extension rules.
- `docs/SOURCE_OF_TRUTH.md` — Governance stack and authority model.

### Key laws from AGENTS.md

- **Content schema is sealed** (`src/content/config.ts`). Changes are cross-repo contract changes.
- **No client framework islands.** Default to plain Astro; scoped browser scripts only.
- **Utilities must stay pure.** No DOM manipulation or browser globals in `src/utils/`.
- **Layers are not interchangeable.** `ds` → `template` → `pages` is the import direction. `ds` must not import from `template`.
- **Content normalization belongs before rendering.** Components format; they don't fix broken data.

### Validation by change type

| Change type                    | Required                                               |
| ------------------------------ | ------------------------------------------------------ |
| Content (typo/metadata)        | `npm run lint && npm run validate:content`             |
| Content (new post/taxonomy)    | Baseline + permalink/metadata sanity                   |
| Component/page markup          | Full build + `test:dist` + `test:audit` + visual check |
| Layout/metadata/search/scripts | Full build + regression check                          |
| Schema/config/dependencies     | Full build as cross-repo contract change               |

Full validation: `npm run lint && npm run validate:content && npm run build && npm run test:dist && npm run test:audit`
