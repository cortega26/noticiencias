# Contributing to Noticiencias (Front-End)

## Prerequisites

- Node.js 20 LTS
- pnpm 9 (`npm install -g pnpm`)
- Optional: Cloudflare R2 credentials for CDN image mode (see `.env.example`)

## First-time setup

```bash
pnpm install          # install all deps from lockfile
cp .env.example .env  # fill in any overrides you need locally
```

## Daily development

```bash
npm run dev               # start local dev server at http://localhost:4321
npm run lint              # all content + code checks (ESLint, frontmatter, images)
npm run validate:content  # full frontmatter + TypeScript + schema pass
npm run build             # production build (runs validate:content first)
npm run test:audit        # Vitest unit tests
npm run test:coverage     # Vitest with coverage report in reports/coverage/
npm run test:dist         # dist sanity checks (run after build)
```

## Before opening a PR

1. Consult the **Change Matrix** in `AGENTS.md §9` and run the minimum required
   commands for your change class.
2. For component, layout, or route changes, also run:
   ```bash
   npm run build
   npm run test:dist
   npm run test:audit
   ```
3. Verify at 375 px and 1280 px — no console errors, no broken images, no broken
   canonical metadata.
4. No "we'll fix it later" workarounds. If the change needs a follow-up to be safe,
   the task is not complete.

## Key directories

| Path | Purpose |
|------|---------|
| `src/content/posts/` | Content source of truth (MDX articles) |
| `src/content/config.ts` | Frontmatter schema — do not change without reading LAW-F1 |
| `src/pages/` | Route entrypoints and `getStaticPaths` |
| `src/layouts/` | Page chrome and metadata plumbing |
| `src/components/ds/` | Noticiencias design-system primitives |
| `src/components/template/` | Astrowind shell and legacy widgets |
| `src/utils/` | Pure data and URL helpers |
| `docs/` | Architecture, editorial policy, decision records |

## Env vars

See `.env.example`. All variables are optional in local development. Without R2
credentials the site falls back to Astro's built-in image optimization.

## Architecture and governance

- `AGENTS.md` — binding engineering governance (read before any edit)
- `docs/ARCHITECTURE.md` — per-layer responsibilities and dependency rules
- `docs/SOURCE_OF_TRUTH.md` — which files win when docs and code disagree
- `docs/adr/` — architecture decision records explaining major trade-offs
