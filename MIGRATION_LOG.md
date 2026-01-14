# Migration Log: Jekyll to Astro

**Date:** 2026-01-14
**Project:** Noticiencias
**Status:** Success

## 1. Inventory & Analysis
- **Source**: Jekyll site coupled with Minimal Mistakes theme.
- **Content**: 7 Markdown posts.
- **Key Requirement**: Strict URL parity for SEO preservation.

## 2. Migration Steps Executed

### Astro Architecture
- Initialized empty Astro project.
- Installed integrations: `sitemap`, `rss`, `mdx`, `lunr`.
- Created strict Content Collection schema (`src/content/config.ts`) enforcing types for `editorial_score`, `fact_check`, etc.

### URL Strategy (Critical)
- **Goal**: Zero broken links.
- **Method**:
  1. Extracted all live URLs from Jekyll `sitemap.xml`.
  2. Created `match_urls.js` to fuzzy-match legacy URLs to Markdown files.
  3. Injected `permalink` front-matter into `src/content/posts/*.md`.
  4. Implemented `[...slug].astro` dynamic route to honor these permalinks.
- **Result**: All original URLs (e.g., `/ciencia/investigaciones/descubrimiento...`) work identically in Astro.

### Features Replaced
| Feature | Jekyll | Astro (New) |
| :--- | :--- | :--- |
| **Search** | Lunr (Plugin) | Lunr (Client-side custom implementation) |
| **RSS** | jekyll-feed | @astrojs/rss endpoint |
| **SEO** | jekyll-seo-tag | Custom BaseLayout + JSON-LD Schema |
| **Deployment** | GitHub Pages (Ruby) | GitHub Actions + Astro Build |

## 3. Post-Migration Verification
- **Build**: Passed (`npm run build`).
- **Sitemap**: Generated at `dist/sitemap-index.xml`.
- **Pages**: 9 static pages generated (Home, Search, RSS, 7 Posts).

## 4. Next Steps for User
1. Push `noticiencias-astro` to GitHub.
2. Enable GitHub Pages in repository settings (Source: GitHub Actions).
3. Switch DNS if necessary (or just replace repo content).
