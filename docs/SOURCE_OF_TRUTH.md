# Frontend Source Of Truth

Status: Active and binding  
Scope: `/home/carlos/VS_Code_Projects/noticiencias/noticiencias`

## Purpose

This document defines which files are authoritative for the frontend repo, how this repo relates to the backend repo, and which documents are binding versus informative.

This file governs documentation hierarchy. It does not replace code-owned contracts.

## Reality Snapshot

The frontend is a static Astro site with:

- published content in `src/content/posts/`
- one content collection contract in `src/content.config.ts`
- site and blog path configuration in `src/config.yaml`
- route entrypoints in `src/pages/`
- shared layout and metadata plumbing in `src/layouts/`
- two UI layers, `components/ds/` and `components/template/`
- page-scoped browser behavior, not a client application shell

The sibling backend repo `../noticiencias_news_collector` may generate and publish Markdown into this repo, but it does not own frontend routing, metadata emission, or render-time behavior.

## Authority Model

Authority is split by concern.

### Code-Owned Authority

These files are the source of truth for the exact contract they implement:

1. `src/content.config.ts`
   - authoritative post frontmatter schema
2. `src/config.yaml`
   - authoritative site metadata defaults, canonical site URL, and blog pathname configuration
3. `src/utils/permalinks.ts`
   - canonical permalink and canonical URL helper behavior
4. `src/utils/blog.ts`
   - normalized post loading, taxonomy extraction, and duplicate permalink detection
5. `src/components/template/common/Metadata.astro`
   - final SEO tag emission path
6. `.github/workflows/*.yml` and `package.json`
   - authoritative CI and validation commands

If prose disagrees with one of the files above about a field name, route base, or validation command, the code file wins and the documentation must be updated.

### Documentation Authority

For repo governance and contributor behavior, authority is:

1. `AGENTS.md`
2. `docs/SOURCE_OF_TRUTH.md`
3. `docs/ARCHITECTURE.md`
4. `docs/tagging.md`
5. `README.md`

`README.md` is a starting point, not a substitute for the binding docs above.

## Repo Boundary With The Backend

The backend repo owns:

- ingestion
- scoring
- editorial automation
- publication orchestration
- the mirrored frontend contract in `news_collector/contracts/frontend_schema.py`

The frontend repo owns:

- the actual render schema in `src/content.config.ts`
- page routes, canonical pathnames, and metadata emission
- image rendering rules
- search UI and search index shape
- build and deploy behavior

Cross-repo rule:

- Any change to the post frontmatter schema, permalink assumptions, category/tag expectations, or publication file location is a cross-repo contract change and must be treated as such in both repos.

## Binding Current Truths

- The only content collection in active use for published articles is `posts`.
- New contributor guidance must reference `src/content/posts/`, not legacy \_posts or src/content/post/ (deprecated path, does not exist).
- Category and tag archive pathnames come from `src/config.yaml`, currently `categorias` and `temas`.
- Metadata flows through page/layout props into `src/components/template/common/Metadata.astro`; pages should not bypass that path for normal SEO.
- Search is implemented as:
  - build-time serialized Lunr index + compact result store in `src/pages/search.json.js` (via `src/utils/build-search-index.ts`, plan 039)
  - browser-only `lunr.Index.load()` deserialize in `src/components/common/SearchInterface.astro`
- View transitions are globally enabled in `src/layouts/template/Layout.astro`; routed page scripts must therefore be idempotent across Astro navigations.

## Fact Ownership

Each cross-cutting fact type has one owning file (or pair of files, when a
backend/frontend mirror exists). When that fact changes, the owner is
responsible for updating the active docs that repeat it — and the doc-drift
gates (`npm run check:doc-drift`, backend `make docs-check`) enforce the
reference.

| Fact                        | Owning file(s)                                                                                           | Repeaters to keep in sync                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Post frontmatter schema     | `src/content.config.ts` (render authority); backend mirror `news_collector/contracts/frontend_schema.py` | `README.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/tagging.md` |
| Site metadata and pathnames | `src/config.yaml`                                                                                        | `README.md`, `docs/ARCHITECTURE.md`, `docs/tagging.md`                    |
| Framework/runtime versions  | `package.json` (dependencies, engines)                                                                   | `README.md`, `docs/supported-dependency-matrix.md`                        |
| CI and validation commands  | `.github/workflows/*.yml` + `package.json` scripts                                                       | `README.md`, `docs/supported-dependency-matrix.md`                        |
| Search implementation       | `src/pages/search.json.js` + `src/utils/build-search-index.ts`                                           | `docs/ARCHITECTURE.md`, `docs/SOURCE_OF_TRUTH.md`                         |
| Deployment host/URLs        | `astro.config.mjs` / `src/config.yaml`                                                                   | `README.md`, backend `docs/PRODUCT_FLOW.md`                               |
| Report-pipeline contract    | `workers/src/handlers/report.ts` + backend `news_collector/contracts/`                                   | `docs/report-pipeline-setup.md`, `docs/webhook-integration.md`            |

## Non-Authoritative Material

The following are useful context but not operational source of truth:

- `docs/migration/**`
- `docs/logs/MIGRATION_LOG.md`
- `docs/audits/**`
- one-off plans, diagnoses, and implementation notes in the repo root

Historical docs must not be used to justify current architecture if they conflict with the active files above.

## Historical Boundaries

Files under `docs/migration/`, `docs/logs/`, `docs/audits/`, `docs/adr/`, and the
repo-root `CHANGELOG.md` are **historical evidence**, not active documentation. Rules:

- They document what was decided or observed when they were written.
- Do not bulk-edit them to match current behavior; preserve them as the record they are.
- If a current doc conflicts with a historical record, the active doc wins.
- `npm run check:doc-drift` checks only active docs; historical scopes are deliberately excluded.
- A PR that only edits historical scopes does not need an active-doc review.
