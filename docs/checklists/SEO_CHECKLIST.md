# SEO Verification Checklist

## Core
- [ ] **Title Tags**: Present on all pages. Format: "Title | Noticiencias".
- [ ] **Meta Descriptions**: Present and matches front-matter or default.
- [ ] **Canonical URLs**: Present and self-referencing (including https://).
- [ ] **Favicon**: Loading correctly.

## Social
- [ ] **OpenGraph (OG)**:
  - `og:title`
  - `og:description`
  - `og:image` (absolute URL)
  - `og:type` ('website' or 'article')
  - `og:locale` ('es_ES')
- [ ] **Twitter Cards**:
  - `twitter:card` ('summary_large_image')
  - `twitter:site` ('@noticiencias')

## Structured Data (Schema.org)
- [ ] **NewsArticle**: Present on all post pages.
  - `headline`
  - `image`
  - `datePublished`
  - `author`

## Technical SEO
- [ ] **Sitemap**: `/sitemap-index.xml` and `/sitemap-0.xml` exist.
- [ ] **RSS**: `/rss.xml` exists and validates.
- [ ] **Robots.txt**: Exists (default Astro handles this or needs manual add).

## URL Parity
- [ ] All URLs from `URL_PARITY_REPORT.csv` return 200 OK on the new site.
