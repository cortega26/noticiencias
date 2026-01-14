# Jekyll + Minimal Mistakes → Astro Migration Plan for noticiencias.com

## Goal
Migrate the site from Jekyll + Minimal Mistakes to Astro with zero broken URLs, preserved SEO, improved UX, GitHub Pages deployment via GitHub Actions, and clean documented architecture.

---

## Phase 0 – Discovery & Freeze

### Repository Audit
Inventory:
- `_posts/**/*.md`
- `_layouts`, `_includes`, `_data`
- `_config.yml` (SEO, permalinks, metadata)
- Categories & tags
- Search, pagination, author profiles
- Assets: `/assets/images`, `/assets/css`, `/assets/js`
- `feed.xml`, `sitemap.xml`

### Lock URLs
- Build site with Jekyll.
- Crawl sitemap and export all live URLs.
- Save as `URL_PARITY_REPORT.csv`.

---

## Phase 1 – Astro Skeleton

```bash
npm create astro@latest noticiencias-astro
cd noticiencias-astro
npm install
npm install @astrojs/sitemap @astrojs/rss @astrojs/mdx sharp lunr
```

Enable integrations in `astro.config.mjs`.

---

## Phase 2 – Content Migration

### Move posts
Copy `_posts` → `src/content/posts`.

### Normalize front‑matter
Keep:
- title, date, categories, tags, author, image, permalink.

### Define collection
`src/content/config.ts` with Zod schema for posts.

---

## Phase 3 – URL Parity Layer

Implement dynamic routes in `src/pages/[...slug].astro` using `getStaticPaths()` so every `permalink` from Jekyll is reproduced exactly.

---

## Phase 4 – Layouts & IA

Create:
- `BaseLayout.astro`
- `PostLayout.astro`

Features:
- Reading time
- Author profile block
- TOC
- Related posts
- Category/tag chips

---

## Phase 5 – Homepage Redesign

Sections:
- Lead story
- Trending categories
- Latest posts
- Investigations / deep dives

---

## Phase 6 – Search

Generate Lunr index via script into `/public/search.json`.
Create client‑side search UI.

---

## Phase 7 – SEO & Metadata

- OpenGraph + Twitter meta per page
- NewsArticle schema
- Breadcrumb schema for archives

---

## Phase 8 – RSS & Sitemap

- RSS via `@astrojs/rss`
- Sitemap via `@astrojs/sitemap`

---

## Phase 9 – GitHub Pages Deployment

Create `.github/workflows/deploy.yml`:
- Build Astro
- Push `/dist` to `gh-pages`

---

## Phase 10 – Validation

Checklist:
- All legacy URLs reachable
- Lighthouse > 90 mobile
- RSS valid
- Sitemap valid
- OG preview correct

---

## Phase 11 – Decommission Jekyll

- Archive old repo
- Tag final Jekyll commit

---

## Deliverables

- MIGRATION_LOG.md
- URL_PARITY_REPORT.csv
- SEO_CHECKLIST.md
