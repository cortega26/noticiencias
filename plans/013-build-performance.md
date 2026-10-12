# Plan 013: Fix frontend build-time quadratic work and serial image pipeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- src/utils/blog.ts src/utils/related.ts "src/pages/[...slug].astro" "src/pages/temas/[tag]/[...page].astro" src/pages/llms-full.txt.ts scripts/publish-image-derivatives.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (plan 015's characterization tests follow; if 015
  lands first, reuse its fixtures)
- **Category**: perf
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

Build time grows superlinearly with corpus size in four places, all on the
critical `npm run build` path (which runs `publish:image-derivatives`
first): every article page re-ranks related posts against the full corpus
with a per-candidate tag-`Set` rebuild; every tag page re-fetches and
re-filters the whole collection for data its own `getStaticPaths` already
computed; `llms-full.txt` loads the collection twice and grows its output
with `+=`; the image publisher awaits every sharp encode + R2 PUT serially.
Each fix is output-identical and independently verifiable.

## Current state

Facts (all verified 2026-10-11):

1. `src/pages/[...slug].astro:22` — every article page calls
   `rankRelatedPosts(post, await fetchPosts(), 4)`; `src/utils/related.ts`
   scores all N candidates per page and rebuilds the original-post tag
   `Set` per candidate (the `sharedTagCount` path). Build-wide cost ≈
   N²·T set constructions + scoring.
2. `src/pages/temas/[tag]/[...page].astro:15-20`:
   ```text
   const allPosts = await fetchPosts();
   const relatedTopics = getRelatedTopics(allPosts, tag?.slug || '', 8);
   const tagPosts = tag
     ? allPosts.filter((post) => post.tags?.some((item) => item.slug === tag.slug))
     : [];
   ```
   `page.data` already holds exactly this tag's paginated posts — the
   re-filter and the full-collection `getRelatedTopics` scan (hub.ts:129)
   are duplicate traversals per tag page.
3. `src/pages/llms-full.txt.ts:9-15` — local `stripFrontmatter` splits on
   `'---'`; `:31-33` calls both `fetchPosts()` (which MDX-`render()`s every
   post) and `getCollection('posts')`; the response grows via `output +=`
   in a per-post loop (O(totalBytes²) copies as the corpus grows).
4. `scripts/publish-image-derivatives.js:131-133` awaits
   `buildManifestEntry` per source image in a `for` loop; `:96-106` awaits
   `objectExists` + `uploadVariant` (sharp AVIF encode + network PUT) per
   width, also serially. Uploads are idempotent existence-checked PUTs.
5. `src/utils/blog.ts:204-213` — `load()` maps every post to
   `getNormalizedPost` (each awaiting MDX `render()`) inside one unbounded
   `Promise.all`; `findPostsBySlugs`/`findPostsByIds` (`blog.ts:255-282`)
   do `posts.find` per id (O(M·N)):
   ```text
   const normalizedPosts = posts.map(async (post) => await getNormalizedPost(post));
   const results = (await Promise.all(normalizedPosts)) ...
   return slugs.reduce((r, slug) => {
     const post = posts.find((p) => p.slug === slug);
   ```

Repo conventions: build-time computation over runtime work (AGENTS.md §6);
`fetchPosts()` memoizes per build; `stripMarkdown` in
`src/utils/build-search-index.ts:42-70` is the converged markdown-cleaning
winner (strips frontmatter + fences + links + HTML + emphasis — strictly
more capable than the local `stripFrontmatter`).

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

- `src/utils/related.ts` (hoist tag sets; accept precomputed sets)
- `src/pages/[...slug].astro` (pass precomputed data or memoize per post id)
- `src/pages/temas/[tag]/[...page].astro` (derive from `page.data`/props, drop second `fetchPosts()`)
- `src/pages/llms-full.txt.ts` (single collection pass, `stripMarkdown`, array-join)
- `src/utils/blog.ts` (Map-backed lookups; chunked render fan-out)
- `scripts/publish-image-derivatives.js` (bounded promise pools)

**Out of scope** (do NOT touch, even though they look related):

- Ranking/scoring semantics — output ordering must be snapshot-identical.
- Search index format (`build-search-index.ts`) — plan 014 owns the budget question.
- R2 credentials/mode selection — untouched.
- `src/utils/hub.ts` internals — call it less often, don't rewrite it.

## Git workflow

- Branch: `advisor/013-build-perf`
- Commit per step (one step = one file-area); e.g.
  `perf(build): index related-post tag sets once per build`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci`, `npm run test:audit`, and one `npm run build` on the
unmodified checkout. Record wall-clock build time and save the built
`dist/llms-full.txt` + two sample article pages + one tag page for
byte-comparison later.

**Verify**: install, tests, build all green; reference artifacts saved
outside the repo (e.g. `/tmp/opencode/plan013-baseline/`).

### Step 1: Index related-post lookups

1. Build a `Map<postId, Set<tagSlug>>` once per build; change
   `sharedTagCount` to take precomputed sets instead of rebuilding them.
2. Optionally compute all related lists in a single pass and pass via
   props from `getStaticPaths`; at minimum memoize `rankRelatedPosts`
   results per post id during the build.

**Verify**: `npm run test:audit` passes; related-post sections in the
Step-0 sample article pages are byte-identical after a rebuild.

### Step 2: Derive tag pages from paginated props

Pass the tag's full post list and related topics as `props` from
`getStaticPathsBlogTag`; drop the second `fetchPosts()` + re-filter in
`src/pages/temas/[tag]/[...page].astro`. Keep URL/contract behavior identical.

**Verify**: tag pages byte-identical vs Step-0 baseline; `test:audit` passes.

### Step 3: Single-pass llms-full with array join

1. Replace the local `stripFrontmatter` with `stripMarkdown` from
   `~/utils/build-search-index` (delete the local function).
2. Single `fetchPosts()` pass (keep `getCollection` only if raw bodies are
   genuinely unavailable from `Post` — prove it before keeping).
3. Collect parts in an array and `join('')` instead of `output +=`.

**Verify**: `dist/llms-full.txt` byte-identical (or cleaner-only diff —
if `stripMarkdown` removes noise the old splitter kept, record the diff
in the commit message and confirm it is strictly removals of markup
artifacts, never prose); `test:audit` passes.

### Step 4: Pool the image-derivative publisher

Map source images into a concurrency-limited pool (4–8 in flight) and pool
the inner width-variant loop the same way. Keep `writeManifest` semantics
unchanged (manifest write still happens once, after all entries resolve).

**Verify**: `npm run publish:image-derivatives` produces a byte-identical
`data/image-derivatives-manifest.json` vs baseline; wall-clock improves.

### Step 5: Bound MDX fan-out and index slug/id lookups

1. Process posts in chunks of ~16–32 through `getNormalizedPost` instead
   of one unbounded `Promise.all` (tune to keep peak memory flat —
   measure RSS before/after if possible, else keep the chunk size and note it).
2. Build `Map<slug|id, Post>` once in `fetchPosts()` and use it in
   `findPostsBySlugs`/`findPostsByIds`.

**Verify**: `npm run build && npm run test:dist && npm run test:audit`
all green; article routes byte-identical vs baseline.

## Test plan

- No new test files required, but each step's byte-identity check IS the
  test (record diffs in commit messages).
- If a byte diff appears that is not strictly explainable (Step 3 markup
  cleanup), treat it as a regression: STOP and report.
- Existing suites (`test:audit`, `test:dist`) must pass after every step.
- Pattern: snapshot-compare built artifacts, as `test:dist` does.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "posts.find" src/utils/blog.ts` returns no matches
- [ ] `grep -n "stripFrontmatter" src/pages/llms-full.txt.ts` returns no matches
- [ ] `grep -n "output += " src/pages/llms-full.txt.ts` returns no matches
- [ ] `grep -n "await fetchPosts()" "src/pages/temas/[tag]/[...page].astro"` returns no matches
- [ ] `npm run build` wall-clock is lower than the Step-0 baseline (record both numbers in the final commit message)
- [ ] `npm run test:dist` exits 0
- [ ] `npm run test:audit` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- Any step changes built output bytes beyond the documented Step-3 cleanup.
- Pooling the publisher changes manifest bytes (write-ordering bug — the
  manifest assembly must be order-independent).
- Chunking MDX rendering changes route output (ordering/dedup must be preserved).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If pagination is added to the article-related surface, the memoization
  in Step 1 must be revisited (cache key includes the full post list).
- Watch build wall-clock in CI after this lands; if it regresses, the
  pools/chunk sizes are the first knobs (documented in code comments).
- **Deferred:** serving/API and collectorths perf live in the backend repo
  (backend plans 124–125), not here.
