# Source-Of-Truth Audit

Date: 2026-04-02  
Scope: frontend repo, with cross-repo checks against `../noticiencias_news_collector`

## Executive Summary

This audit updated the frontend documentation set so it matches the current Astro site instead of the older migration-era shape. The largest corrections were:

- replacing a stale `README.md` that still described React, obsolete paths, and the wrong content structure
- creating an explicit governance stack with `docs/SOURCE_OF_TRUTH.md` and `docs/ARCHITECTURE.md`
- rewriting the tag contract so it matches the backend taxonomy normalizer and the frontend schema actually used in production

This mattered because the previous docs mixed historical migration notes, real current behavior, and aspirational structure in ways that could easily push contributors toward the wrong files or the wrong abstraction boundaries.

## Document Inventory

### Updated

- `README.md`
- `docs/tagging.md`

### Created

- `docs/SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE.md`
- `docs/audits/2026-04-source-of-truth-audit.md`
- `docs/backlog/source-of-truth-backlog.md`

### Left Unchanged

- `AGENTS.md`
  - already reflects the current repo shape and remains the binding operational law
- `docs/EDITORIAL.md`
  - editorial style guidance, not technical governance
- `docs/migration/**`
  - historical migration records; not current source of truth

### Obsolete Or Misleading

- the previous `README.md`
  - described React/Astro structure that does not match the current repo
- the previous `docs/tagging.md`
  - incorrectly treated frontend content usage as the canonical tag registry instead of the backend taxonomy config

## Reality Vs Documentation Gaps

### Stale Claims Removed

- The repo was described as having React/Astro component structure. It does not currently use React islands.
- The old README referenced `src/content/post/`, `pages`, and `authors` collections that are not the current active publication contract.
- The old README described a different component tree than the real `ds` and `template` split.

### Missing Architectural Facts Added

- `src/config.yaml` is the source of truth for site metadata defaults and blog pathnames.
- `src/integration/` owns the custom `astrowind:config` bridge.
- Metadata emission flows through `src/components/template/common/Metadata.astro`.
- Search is a two-part system: build-time `/search.json` generation and a browser-only Lunr UI.

### Cross-Repo Contract Gaps Clarified

- The backend mirrors the frontend post contract in `news_collector/contracts/frontend_schema.py`, but the frontend remains the render schema authority through `src/content/config.ts`.
- The backend taxonomy config is the canonical source for tag aliases, stop tags, and limits.

## Key Governance Improvements

- The documentation stack now separates code-owned truth from prose governance.
- Route ownership, metadata ownership, and search ownership are now explicit.
- The frontend/backend boundary is now documented as a real product boundary instead of implied by README prose.
- Historical migration docs are now clearly secondary rather than silent competitors for authority.

## Recommended Follow-Up Backlog

- Add cross-repo contract automation so frontend schema changes and backend schema mirror changes are checked together.
- Remove render-time legacy title repair from `PostLayout.astro` by fixing source content and publication normalization earlier.
- Move search index URL derivation fully onto shared permalink helpers instead of local fallback logic.
- Add stronger frontend-side tag validation if manual content editing outside the backend remains common.
