# Plan 017: Consolidate frontend duplication (images, search, llms, taxonomy, layout)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- src/utils/normalizeImage.ts src/utils/images.ts src/components/common/Image.astro src/components/common/HeaderSearch.astro src/components/common/SearchInterface.astro src/layouts/PostLayout.astro src/utils/blog.ts src/utils/series.ts src/utils/topics.ts src/utils/categorySections.ts src/utils/browser/analytics-events.ts src/utils/source-publisher.ts "src/pages/[...slug].astro"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 015 (characterization tests should exist first so
  these moves have a fast signal; if 015 hasn't landed, run its Step 1
  blog tests as a prerequisite inside this plan's Step 0 and say so)
- **Category**: tech-debt
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

Five places decide the same thing twice, and one layout does normalization
work the content layer should own: three image-kind classifiers that must
all learn every new source shape; two search-result renderers that diverge
on every display fix; a naive frontmatter splitter beside the converged
search normalizer; route-level author/source/chip fallbacks re-derived on
every article render; three editorial-copy maps with three lookup shapes;
and a drift of silent `catch {}`s against the repo's fail-closed winner
pattern. Each is small; together they are the "same change in N files"
tax. All moves are behavior-preserving by construction, verified by
byte-identity and the 015 tests.

## Current state

Facts (all verified 2026-10-11):

1. **Images**: canonical classifier `src/utils/normalizeImage.ts:11-63`
   (`normalizeStringImage`/`normalizeObjectImage`, `kind: 'local'|'remote'`,
   handles `~/`, `/`, Astro ImageMetadata, backend `{src,alt,width,height}`
   wrapper). Divergent classifiers: `Image.astro:73-80` inline
   `'width' in props.src && ...` checks; `src/utils/images.ts:35-59`
   (`shouldIgnorePath`, `resolveImageKey` re-deriving local/remote kind).
2. **Search**: `HeaderSearch.astro:1-353` (dialog) and
   `SearchInterface.astro:65-241` (page) share `loadIndex`/`search`/
   `normalizeQuery` wiring but each owns an `li`-card builder
   (page's at `:173-232`). Dialog-specific focus/keyboard behavior must
   stay local per LAW-F4.
3. **llms**: local `stripFrontmatter` in `llms-full.txt.ts:9-15` (splits on
   `'---'`). (If plan 013 Step 3 already replaced it with `stripMarkdown`,
   skip this item and record it.)
4. **Layout**: `PostLayout.astro:32-50` builds `displayAuthor` (regex on
   `post.author`), `sourceFallback` (from `post.sources`/`post.source_url`),
   `evidenceChips` (`:54-62`, `unknown`/`other` suppression); plus a
   route-level `post.permalink || getPermalink(...)` fallback in
   `[...slug].astro:21`. `ARCHITECTURE.md` "Known Compatibility Debt"
   sanctions title-cleanup only — not these three derivations (LAW-F6 breach).
5. **Taxonomy copy**: `series.ts:19-30` (`SERIES_DESCRIPTIONS` +
   `fallbackDescription`), `topics.ts:13-24` (`TOPIC_HUB_DESCRIPTIONS` +
   `getTopicHub`), `categorySections.ts:13-106`
   (`configuredCategorySections`) — each comments that copy lives there
   "until the publication contract carries [the] field" (DEC-023 / LAW-F1).
6. **Error handling**: winner pattern (most recent: `search.json.js:11-15,48-50`,
   `blog.ts:115-122`, `SearchInterface.astro:132-134,243-244`) = build paths
   throw fail-closed; browser paths set user-visible status AND
   `console.error`. Deviations: `admin/dashboard.astro:17-19`
   (`catch {}` around metrics read — verified: `} catch { // Metrics not
yet generated }`), `analytics-events.ts:54,64` (`catch {}`),
   `source-publisher.ts:42` (`catch` → null without log),
   `images.ts:18` (unused error var, comment-only). Keep
   `consent.ts:46,63` silent-null (privacy-blocked storage is an expected,
   documented path).

Repo conventions: prefer a little duplication over premature abstraction
(§6) — but these are all _triplicated_ decisions, past the refactor
trigger ("same transform in two files", §5). New shared code must be
feature-owned (search-owned module, taxonomy-owned module), never generic
`utils/` catch-alls (LAW-F5). `ds` must not import `template` (LAW-F2 —
verify none of these moves creates such an import).

## Commands you will need

| Purpose | Command              | Provenance | Expected on success |
| ------- | -------------------- | ---------- | ------------------- |
| Install | `npm ci`             | declared   | exit 0              |
| Lint    | `npm run lint`       | declared   | exit 0              |
| Unit    | `npm run test:audit` | declared   | all pass            |
| Build   | `npm run build`      | declared   | exit 0              |
| Dist    | `npm run test:dist`  | declared   | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/components/common/Image.astro`, `src/utils/images.ts` (consume `normalizeImage`)
- `src/components/common/HeaderSearch.astro`, `src/components/common/SearchInterface.astro` (shared card-builder module)
- `src/pages/llms-full.txt.ts` (only if plan 013 didn't already do it)
- `src/utils/blog.ts` (`getNormalizedPost` gains resolved author/source/chips), `src/layouts/PostLayout.astro` (render fields), `src/pages/[...slug].astro` (drop fallback)
- New `src/utils/taxonomy-copy.ts` (interim single home) + the three source files (re-export or delegate)
- The four silent catches (log-with-context)

**Out of scope** (do NOT touch, even though they look related):

- Moving taxonomy copy into the sealed contract (that is a LAW-F1
  cross-repo schema change — file it as a follow-up, don't do it here).
- `template/` widget system or `ds`↔`template` direction (LAW-F2).
- Backend `enrichment`/`taxonomy` modules — different repo.
- `consent.ts` silent-null paths — explicitly kept.

## Git workflow

- Branch: `advisor/017-frontend-debt`
- Commit per item (6 commits max); e.g.
  `refactor(images): route Image.astro through normalizeImage`.
- Visual verification per `AGENTS.md` §7 for the search/image items
  (375px + 1280px, no console errors, no broken images/canonicals).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Prerequisites and baseline

Confirm plan 015's tests exist and pass; if not, implement its Step 1
(blog tests) here first and note it. Build once and save reference
artifacts (homepage, one article, `/buscar/`, one tag page) for
byte-identity checks.

**Verify**: `npm run test:audit` green; reference artifacts saved.

### Step 1: Images — single classifier

Make `Image.astro` + `images.ts` switch on `normalizeImage(x)?.kind`
exclusively; delete the ad-hoc `startsWith('/')` / `in`-operator checks.
Add unit tests for the backend-object-wrapper shapes.

**Verify**: `npm run build && npm run test:dist` green; hero images
byte-identical vs baseline; `test:audit` passes.

### Step 2: Search — shared card renderer

Extract the card-builder + status-string helpers into a search-owned
browser module (not generic `utils/`); both `HeaderSearch` (keeps
dialog/focus logic) and `SearchInterface` (keeps URL-sync/page logic) call
it. Keep the `doc.image` thumbnail-drop behavior both sites currently
share (see `search.json.js:19-21`).

**Verify**: dialog + page render identically (byte-compare built
`/buscar/` + manual dialog check at 375px/1280px per §7); `test:audit` passes.

### Step 3: Layout — move fallbacks to normalization

Extend the `Post` shape (or a view-model) in `utils/blog.ts` with resolved
`displayAuthor`/`sourceFallback`/chips; `PostLayout.astro` renders fields;
`[...slug].astro:21` uses `post.permalink` unconditionally after the
fail-closed duplicate check.

**Verify**: article pages byte-identical vs baseline; `test:audit` passes.

### Step 4: Taxonomy copy — one interim home

Create one interim module exporting
`getSeriesDescription/getTopicHub/getCategorySection`; the three source
files delegate to it (keep their exports stable — other importers must not
change). File the contract-schema follow-up as a `**Deferred:**` note
(see Done criteria), don't grow a fourth map.

**Verify**: taxonomy/series pages byte-identical; `test:audit` passes.

### Step 5: Error-handling convergence

Dashboard/analytics/publisher catches log via `console.warn` with source
context; where null is the contract, keep silence but cite the reason
inline (match the `consent.ts` documented pattern).

**Verify**: `npm run lint` green; no behavior change (logging only).

## Test plan

- New unit tests for image-wrapper shapes (Step 1) and taxonomy getters
  (Step 4, asserting identical return values to the old maps).
- Byte-identity of built pages is the regression net for Steps 2–3
  (record the compared URLs in commit messages).
- Existing `test:audit` + `test:dist` must pass after every step.
- Manual §7 verification (375/1280px, no console errors) for Steps 1–2.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "'width' in props.src" src/components/common/Image.astro` returns no matches
- [ ] One shared search-card module exists; both components import it
- [ ] `grep -n "displayAuthor\|sourceFallback" src/layouts/PostLayout.astro` shows only reads, no derivations
- [ ] `npm run build && npm run test:dist && npm run test:audit` all green
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (especially if plan 013 already did the `stripMarkdown` item).
- Any step changes built bytes (except nothing — all steps here must be byte-identical).
- A move would create a `ds`→`template` import (LAW-F2 violation — restructure, don't violate).
- `[...slug].astro` cannot use `post.permalink` unconditionally (fail-closed
  check insufficient — report, don't reintroduce the fallback).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The taxonomy-copy interim module is tech debt with a named exit (sealed
  contract field per DEC-023). **Deferred:** move series/topic/category
  descriptions into the cross-repo publication contract — needs a LAW-F1
  schema change + backend mirror, unblocked by nothing but editorial decision.
- If a third UI surface needs search cards, it must use the shared module —
  a third copy is a review rejection per §5.
