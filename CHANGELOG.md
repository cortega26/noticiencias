# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **Content schema as sealed contract**: `src/content.config.ts` is the single authoritative source of truth for the `posts` collection frontmatter. Schema versioning, mandatory `excerpt` field, and fail-closed validation enforce data integrity at build time.
- **Image derivative pipeline**: R2-backed AVIF generation and delivery via `data/image-derivatives-manifest.json`. Includes `publish:image-derivatives` script, CDN fallback, and CI enforcement (`IMAGE_DERIVATIVES_REQUIRE_URL`).
- **Content Guard CI workflow** (`.github/workflows/content-guard.yml`): back-end contract parity checks, heading structure validation, frontmatter linting, link checking, and image quality gates.
- **Contract snapshot sync** (`.github/workflows/sync-contract-snapshot.yml`): automated cross-repo contract snapshot generation and parity check fallback.
- **Image delivery quota workflow** (`.github/workflows/image-delivery-quota.yml`): monitors and enforces image delivery constraints.
- **Derivatives manifest auto-sync** (`.github/workflows/sync-image-derivatives-manifest.yml`): keeps manifest in sync across branches.
- **llms.txt / llms-full.txt endpoints**: spec-compliant SEO endpoints for LLM discoverability, with sync tooling.
- **EEAT structured data**: JSON-LD structured data for articles (schema.org `Article`/`NewsArticle`) strengthening Expertise, Authoritativeness, and Trustworthiness signals.
- **Open Graph image metadata**: per-article OG image generation for social sharing previews.
- **Search infrastructure**: build-time JSON search index with Lunr client-side querying, URL parameter support, and query normalization.
- **Report a problem page** (`/reportar`): configurable form endpoint with dynamic field display based on problem type.
- **Strict tagging policy**: documented tag taxonomy (`docs/tagging.md`), backfill scripts, auditing tooling, and topic strip filtering (count ≥ 2, capped at 6).
- **404 error page**: fail-closed error handling across content schemas and search index generation.
- **Favicons component**: centralized favicon asset management.
- **Footer credit**: configurable author credit with portfolio link.
- **Editorial voice doctrine**: `EDITORIAL_VOICE.md` establishing tone, anglicism rules, and style guidelines.
- **ADR-0004**: architectural decision record for `npm ci` over `pnpm`.
- **Documentation drift check**: automated detection of stale references in governance docs.
- **CodeGraph integration**: tree-sitter–parsed knowledge graph for code intelligence.
- **UI/UX implementation plan**: self-contained design-system backlog.
- **Daily Desk component**: editorial dashboard for content operations.
- **SQLite enrichment metrics database**: tracks content enrichment history and metrics.
- **VS Code workspace configuration**: multi-root setup for related project folders.

### Changed

- **Astro 5 → 6 migration**: full framework upgrade with server-first rendering.
- **Node.js 20 → 24**: runtime engine upgrade.
- **Image delivery mode**: switched from CDN to GitHub-backed delivery for hero images.
- **Template component freeze**: `src/components/template/` is now a frozen legacy layer; new UI work goes into `src/components/ds/`.
- **UI layer separation**: `ds` (design system) and `template` (Astrowind shell) are now architecturally distinct layers with import direction enforced.
- **Content normalization**: moved from rendering-time repair to pre-render pipeline (`src/utils/blog.ts`).
- **Search page**: enhanced with Lunr type safety, URL parameter support, View Transitions compatibility, and richer result display.
- **Newsletter form**: hidden when endpoint is not configured.
- **Topic strip**: shows only tags with count ≥ 2, capped at 6.
- **Permalink generation**: unified through `src/utils/permalinks.ts`; article slugs use Spanish-title convention with lint gate enforcement.
- **Homepage hierarchy**: improved visual consolidation per editorial voice doctrine (D1–D8).
- **Typography**: migrated to Playfair Display with refreshed color palette.
- **Twitter handle**: updated from `@noticiencias` to `@noti_ciencias`.
- **Author field**: standardized from `Noticiencias AI` to `Noticiencias` across all articles.
- **Footer credit**: translated to Spanish (`Desarrollado por`).
- **Governance docs**: `CLAUDE.md` merged into `AGENTS.md` as single authoritative agent governance document.

### Fixed

- **Image pipeline**: resolved silently dropped images, CORS issues with non-CORS hosts, missing hero images, and stale refinery manifest entries.
- **CI/CD**: repaired Content Guard TypeScript errors, added `--legacy-peer-deps` to build job, added concurrency groups and timeouts, hardened deploy verification, and fixed multiline curl header parsing.
- **Dependabot PRs**: back-end contract check now skipped for automated dependency PRs.
- **Accessibility**: removed silent image alt fallback, replaced generic `Imagen de` alt text, improved keyboard navigation, tap targets, and heading structure; added quality lint gate for alt text.
- **Performance**: deferred non-critical scripts, stabilized CLS (Cumulative Layout Shift), and removed duplicate collection fetches.
- **Security headers**: implemented verification and enforcement.
- **XSS vulnerabilities**: fixed cross-site scripting issues in form handling and URL processing.
- **URL substring sanitization**: hardened URL validation to prevent incomplete sanitization attacks.
- **Workflow permissions**: added minimum required permissions to all GitHub Actions workflows.
- **Article slug normalization**: renamed `article-NNN` pattern posts to Spanish-title slugs.
- **Script idempotency**: updated `BasicScripts` component for safe re-execution across Astro page transitions.
- **Various npm audit fixes**: resolved vulnerabilities in `undici`, `vite`, `lodash`, `tar`, `fast-xml-parser`, `brace-expansion`, `defu`, and `devalue`.

### Security

- **Lodash prototype pollution**: forced resolution to `4.17.23` via `package.json` overrides (GHSA-xxjr-mmjv-4gpg).
- **XSS hardening**: fixed cross-site scripting vectors in form handling and URL processing.
- **Security headers**: implemented header verification and enforcement pipeline.
- **Workflow permissions**: applied principle of least privilege to all GitHub Actions workflows.
- **URL validation**: hardened against incomplete URL scheme check and substring sanitization bypasses (CodeQL alerts 1–3).
- **npm audit fixes**: resolved supply-chain vulnerabilities in `undici`, `vite`, `tar`, and other dependencies.

## [0.1.0] - 2026-01-24

### Security

- **Lodash Vulnerability Fix**: Forced resolution of `lodash` to version `4.17.23` via `package.json` overrides to address prototype pollution vulnerability (GHSA-xxjr-mmjv-4gpg) introduced transitively by `@astrojs/check`.
