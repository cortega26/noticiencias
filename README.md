# Noticiencias Frontend

Frontend repo for `noticiencias.com`.

This repository is a static Astro 5 site with MD/MDX content under `src/content/posts`, a custom Astrowind-derived shell, and a small amount of page-scoped browser behavior. It is the presentation layer of the Noticiencias system; ingestion, scoring, editorial automation, and publication orchestration live in the sibling backend repo `../noticiencias_news_collector`.

## Current State

- Rendering model: server-first Astro with `ClientRouter` view transitions enabled in [`src/layouts/template/Layout.astro`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/layouts/template/Layout.astro).
- Content contract: the only authoritative post schema is [`src/content/config.ts`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/content/config.ts).
- Site/blog configuration: canonical site metadata, robots defaults, and route pathnames live in [`src/config.yaml`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/config.yaml).
- Metadata emission: pages pass metadata through layouts into [`src/components/template/common/Metadata.astro`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/components/template/common/Metadata.astro).
- URL and taxonomy helpers: [`src/utils/permalinks.ts`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/utils/permalinks.ts) and [`src/utils/blog.ts`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/utils/blog.ts).
- Search: build-time JSON at [`src/pages/search.json.js`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/pages/search.json.js) plus a browser-only Lunr UI on [`src/pages/buscar.astro`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/pages/buscar.astro).
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
- `npm run lint`
- `npm run validate:content`
- `npm run build`
- `npm run test:dist`
- `npm run test:audit`
- `npm run test:deploy -- <deployed-url>`

## Governance Docs

- [`AGENTS.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/AGENTS.md): binding review and change law for this repo.
- [`docs/SOURCE_OF_TRUTH.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/docs/SOURCE_OF_TRUTH.md): governance stack, authority model, and repo boundary with the backend.
- [`docs/ARCHITECTURE.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/docs/ARCHITECTURE.md): actual module boundaries, data flow, and extension rules.
- [`docs/tagging.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/docs/tagging.md): cross-repo tagging contract.
- [`docs/audits/2026-04-source-of-truth-audit.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/docs/audits/2026-04-source-of-truth-audit.md): documentation audit for this pass.
- [`docs/backlog/source-of-truth-backlog.md`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/docs/backlog/source-of-truth-backlog.md): prioritized follow-up backlog.

## Notes

- This repo does not currently use React islands or a separate client framework.
- Historical migration material under `docs/migration/` and `docs/logs/MIGRATION_LOG.md` is useful context, but it is not the operational source of truth for the current site.
