# Contributing to Noticiencias (Front-End)

## Prerequisites

- Node.js 24.x (`nvm use` picks the right version from `.nvmrc`)
- npm (bundled with Node.js — do **not** use pnpm or yarn; see `docs/adr/0004-npm-over-pnpm.md`)
- Optional: Cloudflare R2 credentials for CDN image mode (see `.env.example`)

## First-time setup

```bash
npm ci                # install exact deps from package-lock.json
cp .env.example .env  # fill in any overrides you need locally
```

## Daily development

```bash
npm run dev               # start local dev server at http://localhost:4321
npm run lint              # all content + code checks (ESLint, frontmatter, images)
npm run validate:content  # full frontmatter + TypeScript + schema pass
npm run build             # production build (image derivatives + astro build; run `npm run validate:content` separately first if you want the full content-quality gate)
npm run test:audit        # Vitest unit tests
npm run test:coverage     # Vitest with coverage report in reports/coverage/
npm run test:dist         # dist sanity checks (run after build)
```

## Before opening a PR

1. Consult the **Change Matrix** in `AGENTS.md §9` and run the minimum required
   commands for your change class.
2. Run the canonical one-command gate (mirrors the CI PR checks):
   ```bash
   npm run verify:ci
   ```
   This approximates the CI PR checks in one local command (lint, content
   validation, build, dist sanity, unit tests, search budget, browser tests,
   contract sync). CI additionally runs a dependency-graph check, a link
   checker, a Worker test suite, and uses coverage-threshold unit tests and
   explicit-viewport Playwright projects not reproduced here — see
   `.github/workflows/content-guard.yml` for the authoritative CI step list.
3. For component, layout, or route changes, also run:
   ```bash
   npm run build
   npm run test:dist
   npm run test:audit
   ```
4. Verify at 375 px and 1280 px — no console errors, no broken images, no broken
   canonical metadata.
5. No "we'll fix it later" workarounds. If the change needs a follow-up to be safe,
   the task is not complete.

## Fork and Dependabot behavior

- `content-guard.yml` fetches the backend contract schema with a
  least-privilege read token. On fork or Dependabot PRs (where secrets are
  unavailable) it falls back to the committed snapshot
  (`.contract-snapshots/frontend_schema.snapshot.json`) instead of failing.
- `npm run check:contract-sync` is the local equivalent of the contract
  parity gate; it compares `src/content.config.ts` against the backend
  `news_collector/contracts/frontend_schema.py` when the sibling repo is
  present.
- The browser suite always runs against a local build
  (`PLAYWRIGHT_BASE_URL=http://localhost:4321`) — never the live site —
  so fork PRs get the same coverage as main-branch PRs.

## Scheduled maintenance workflows

- `perf-monitor.yml` runs Lighthouse monthly (15th, 09:37 UTC, plus manual
  dispatch): it builds the site, serves `dist/` locally, and writes the
  report under the runtime `reports/` directory (the job creates it
  first — Lighthouse fails if the output directory does not exist).
- Scores below 80 in any category (performance, accessibility, SEO,
  best-practices) raise a `::warning::` annotation and open a
  `performance`-labeled issue automatically.

## Key directories

| Path                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `src/content/posts/`       | Content source of truth (MDX articles)                    |
| `src/content.config.ts`    | Frontmatter schema — do not change without reading LAW-F1 |
| `src/pages/`               | Route entrypoints and `getStaticPaths`                    |
| `src/layouts/`             | Page chrome and metadata plumbing                         |
| `src/components/ds/`       | Noticiencias design-system primitives                     |
| `src/components/template/` | Astrowind shell and legacy widgets                        |
| `src/utils/`               | Pure data and URL helpers                                 |
| `docs/`                    | Architecture, editorial policy, decision records          |

## Env vars

See `.env.example`. All variables are optional in local development. Without R2
credentials the site falls back to Astro's built-in image optimization.

## Architecture and governance

- `AGENTS.md` — binding engineering governance (read before any edit)
- `docs/ARCHITECTURE.md` — per-layer responsibilities and dependency rules
- `docs/SOURCE_OF_TRUTH.md` — which files win when docs and code disagree
- `docs/adr/` — architecture decision records explaining major trade-offs

## Full system setup

This repository is the front-end of a two-repo product. To run the complete system
locally — including the collection pipeline and Refinery editorial UI — follow the
unified setup guide in the back-end repo:

**[`../noticiencias_news_collector/docs/RUNBOOK_LOCAL_DEV.md`](../noticiencias_news_collector/docs/RUNBOOK_LOCAL_DEV.md)**

That document covers:

- back-end bootstrap (`make bootstrap`) and `.env` configuration
- front-end bootstrap (`npm ci`)
- collector dry-run to verify connectivity without side effects
- Refinery UI launch (`make refinery`)
- validation commands by change type (including cross-repo schema changes)
- common failure modes and their fixes

If you are working on front-end content, layout, or components only, the setup steps
in this file are sufficient. If your change touches the publication contract, frontmatter
schema, permalink helpers, category/tag taxonomy, or any cross-repo behavior, use the
full runbook and run validation in both repos.
