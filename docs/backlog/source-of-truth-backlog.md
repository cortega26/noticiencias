# Source-Of-Truth Backlog

## Resolved

### Cross-repo frontend schema parity gate ✅

**Resolved:** June 2026. `scripts/check-contract-sync.js` now performs deep comparison (field names,
types, constraints, nested structures) between `frontend_schema.py` and `src/content.config.ts`.
A committed snapshot (`.contract-snapshots/frontend_schema.snapshot.json`) serves as fallback for
fork/Dependabot PRs where the backend token is unavailable. The gate always runs in CI.

### Unify search index permalink generation ✅

**Resolved:** `src/pages/search.json.js` already uses `resolvePostPermalink()` from
`src/utils/blog.ts` plus `getPermalink()` from `src/utils/permalinks.ts` — the same shared helpers
used by every component (`ArticleCard.astro`, `ListItem.astro`, `GridItem.astro`, etc.). There is no
local fallback URL logic. No action needed.

### Remove render-time legacy title repair ✅

**Resolved / Obsolete:** The referenced file `src/components/template/PostLayout.astro` no longer
exists. The current `src/layouts/PostLayout.astro` contains zero title sanitization or repair logic.
The only title transformation is `.substring(0, 110)` for schema.org `headline` compliance, which is
a standard structured-data constraint, not legacy repair. No action needed.

## High

### Enforce tag quality for frontend-only manual edits

**Problem:** `npm run validate:content` validates shape and hero/image requirements via
`check-tags.js`, but the script only checks form (length, pattern, duplicates). It does not cover
structural issues that the backend `TagNormalizer` would catch: hyphens/underscores instead of
spaces, accent-insensitive duplicates, and overly generic stop-tags.

**Impact:** Manual edits in the frontend repo can introduce tags that pass `check-tags.js` but would
be normalized or rejected by the backend pipeline.

**Status (June 2026):** `check-tags.js` now includes:

- Hyphen/underscore detection (warns when tags contain `-` or `_` instead of spaces)
- Accent-insensitive deduplication (warns when tags differ only by accent marks)
- Stop-tag detection (suggests review when common generic tags like "noticias", "ciencia" are used)

All new checks emit **warnings**, not errors. Semantic normalization (orthography, alias mapping,
stop-tag removal) remains the backend's authority.

**Recommendation:** Consider running `tools/backfill_tags.py --dry-run` in CI if Python and backend
dependencies are available. Otherwise, the current warnings-based approach is sufficient for catching
obvious issues before review.

**Affected repo(s):** frontend, backend

## Medium

### Add documentation drift checks for active governance docs

**Problem:** The repo has link checking in CI but not targeted drift checks for the active governance
stack.

**Impact:** README and docs can become stale when code contracts change.

**Recommendation:** Add a lightweight docs check covering active file paths, commands, and
authority-order references.

**Affected repo(s):** frontend
**Suggested priority:** medium

## Low

### Reduce generic helper sprawl in `src/utils/utils.ts`

**Problem:** `src/utils/utils.ts` remains a generic utility surface while governance rules prefer
domain-named helpers.

**Current state (June 2026):** The file contains only 2 functions (`getFormattedDate`, `trim`) across
49 lines. This is minimal and not an acute problem.

**Recommendation:** When these functions are next touched, consider extracting `getFormattedDate` to
`src/utils/date.ts`. Keep `trim` in place since it is used by `permalinks.ts`.

**Affected repo(s):** frontend
**Suggested priority:** low
