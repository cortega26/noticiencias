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
  - `og:locale` (consistent with the configured language and metadata implementation)
- [ ] **Twitter Cards**:
  - `twitter:card` ('summary_large_image')
  - `twitter:site` (value from `src/config.yaml`, currently `@noti_ciencias`)

## Structured Data (Schema.org)

- [ ] **NewsArticle**: Present on all post pages.
  - `headline`
  - `image`
  - `datePublished`
  - `author`

## Technical SEO

- [ ] **Sitemap**: `/sitemap-index.xml` and `/sitemap-0.xml` exist.
- [ ] **RSS**: `/rss.xml` exists and validates.
- [ ] **Robots.txt**: Matches the committed `public/robots.txt`, including the backing Markdown namespace exclusion.

## URL Parity

- [ ] Affected canonical article/list/taxonomy/search URLs resolve with the configured trailing-slash behavior. Historical migration URL reports are not a complete current route inventory.
