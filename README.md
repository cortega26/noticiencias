# Noticiencias Frontend

_Parte del [ecosistema Tooltician](https://tooltician.com) — periodismo científico, reproducible y open-source._

[![Parte de Tooltician](https://img.shields.io/badge/Parte_de-Tooltician.com-6C47FF?v=2)](https://tooltician.com)

Frontend repo for `noticiencias.com`.

This repository is a static Astro 7 site with MD/MDX content under `src/content/posts`, a custom Astrowind-derived shell, and a small amount of page-scoped browser behavior. It is the presentation layer of the Noticiencias system; ingestion, scoring, editorial automation, and publication orchestration live in the sibling backend repo `../noticiencias_news_collector`.

## Current State

- Rendering model: server-first Astro with `ClientRouter` view transitions enabled in [`src/layouts/template/Layout.astro`](src/layouts/template/Layout.astro).
- Content contract: the only authoritative post schema is [`src/content.config.ts`](src/content.config.ts).
- Site/blog configuration: canonical site metadata, robots defaults, and route pathnames live in [`src/config.yaml`](src/config.yaml).
- Metadata emission: pages pass metadata through layouts into [`src/components/template/common/Metadata.astro`](src/components/template/common/Metadata.astro).
- URL and taxonomy helpers: [`src/utils/permalinks.ts`](src/utils/permalinks.ts) and [`src/utils/blog.ts`](src/utils/blog.ts).
- Search: build-time JSON at [`src/pages/search.json.js`](src/pages/search.json.js) plus a browser-only Lunr UI on [`src/pages/buscar.astro`](src/pages/buscar.astro).
- Deployment: GitHub Pages via `.github/workflows/deploy.yml`.

## Key Directories

- `src/content/posts/`: published articles.
- `src/pages/`: route entrypoints and static path generation.
- `src/layouts/`: page shells and metadata plumbing.
- `src/components/ds/`: Noticiencias design-system primitives.
- `src/components/template/`: Astrowind-derived shell, blog widgets, and shared template pieces.
- `src/components/common/`: site-specific reusable fragments that do not fit `ds` or `template`.
- `src/utils/`: mostly pure data, permalink, search, and image helpers.
- `src/integration/`: custom integration that exposes `astrowind:config` from `src/config.yaml`.
- `tests/`: Vitest coverage for search helpers, slug uniqueness, site integrity, and compliance checks.

## Development

```bash
npm ci
npm run lint
npm run validate:content
npm run build
npm run test:dist
npm run test:audit
```

Useful local commands:

- `npm run dev`
- `npm run publish:image-derivatives`
- `npm run lint`
- `npm run validate:content`
- `npm run build`
- `npm run test:dist`
- `npm run test:audit`
- `npm run test:deploy -- <deployed-url>`

## Image Derivatives

- `data/image-derivatives-manifest.json` records derivative metadata.
- `data/image-delivery-mode.json` selects delivery mode through `src/utils/image-delivery-mode.js`; the committed mode is `github`.
- `npm run publish:image-derivatives` scans post raster images and refreshes the manifest. R2 uploads require both `r2` mode and the relevant R2 environment variables; credentials alone do not select that mode.
- `.env.example`, the publisher script and `.github/workflows/deploy.yml` own credential names and strictness behavior. Build commands can generate files and, when configured for R2, upload derivatives.

## Governance Docs

- [`AGENTS.md`](AGENTS.md): binding review and change law for this repo.
- [`docs/SOURCE_OF_TRUTH.md`](docs/SOURCE_OF_TRUTH.md): governance stack, authority model, and repo boundary with the backend.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): actual module boundaries, data flow, and extension rules.
- [`docs/tagging.md`](docs/tagging.md): cross-repo tagging contract.
- [`docs/audits/2026-04-source-of-truth-audit.md`](docs/audits/2026-04-source-of-truth-audit.md): documentation audit for this pass.
- [`docs/backlog/source-of-truth-backlog.md`](docs/backlog/source-of-truth-backlog.md): prioritized follow-up backlog.

## Back-End System

Content is collected, enriched, and published by the companion back-end repo
[`noticiencias_news_collector`](../noticiencias_news_collector/).

Key references for understanding the full system:

- [`../noticiencias_news_collector/docs/PRODUCT_FLOW.md`](../noticiencias_news_collector/docs/PRODUCT_FLOW.md): end-to-end product flow from RSS article to live page.
- [`../noticiencias_news_collector/docs/PIPELINE_CONTRACTS.md`](../noticiencias_news_collector/docs/PIPELINE_CONTRACTS.md): cross-repo contract shapes and failure semantics.
- [`../noticiencias_news_collector/docs/RUNBOOK_LOCAL_DEV.md`](../noticiencias_news_collector/docs/RUNBOOK_LOCAL_DEV.md): local bootstrap guide for both repos.

## Notes

- This repo does not currently use React islands or a separate client framework.
- Historical migration material under `docs/migration/` and `docs/logs/MIGRATION_LOG.md` is useful context, but it is not the operational source of truth for the current site.

---

Built and maintained by **Carlos Ortega** — automation, data systems, and web technical hygiene consulting. Portfolio and services: **[tooltician.com](https://tooltician.com/)**.

_Part of the [Tooltician](https://tooltician.com) ecosystem — periodismo científico, reproducible y open-source._
