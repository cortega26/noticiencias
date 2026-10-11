# Plan 011: Fix permalink dates to UTC and normalize duplicate detection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- src/utils/blog.ts "src/pages/[...slug].astro" tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but see plan 015 — this plan should land its own
  regression tests; 015 raises the file's coverage floors afterwards)
- **Category**: bug
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

Article permalinks embed the publication date (`/%category%/%slug%` via
`POST_PERMALINK_PATTERN`). `generatePermalink` formats that date with
host-local getters while the backend locks the canonical date in UTC and
the frontend renders dates in UTC (`src/utils/date.ts` uses
`timeZone: 'UTC'`). A post dated at midnight UTC built on a non-UTC host
gets a permalink for the wrong day — mismatching the backend's
`final_slug`/`output_filename` and risking silent duplicate-slug
collisions. Separately, the fail-closed duplicate-permalink guard keys on
raw strings while explicit frontmatter permalinks are returned verbatim,
so `/salud/x` and `salud/x/` pass the guard yet resolve to the same route.
Both are one-spot fixes in `src/utils/blog.ts`.

## Current state

The relevant file is `src/utils/blog.ts` (permalink generation +
normalization; consumed by every route via `fetchPosts()`).

Excerpts as they exist today (verified 2026-10-11):

```text
// src/utils/blog.ts:27-34 — generatePermalink uses LOCAL time getters
const year = String(publishDate.getFullYear()).padStart(4, '0');
const month = String(publishDate.getMonth() + 1).padStart(2, '0');
const day = String(publishDate.getDate()).padStart(2, '0');
const hour = String(publishDate.getHours()).padStart(2, '0');
const minute = String(publishDate.getMinutes()).padStart(2, '0');
const second = String(publishDate.getSeconds()).padStart(2, '0');
```

```text
// src/utils/blog.ts:51-62 — resolvePostPermalink returns explicit permalinks verbatim
const slug = cleanSlug(effectiveSlug);
const publishDate = new Date(data.date ?? new Date());
// ...
return data.permalink || (await generatePermalink({ id, slug, publishDate, category }));
```

```text
// src/utils/blog.ts:237-248 — duplicate guard keys on the raw permalink string
const seen = new Map<string, string>();
for (const post of _posts) {
  const existing = seen.get(post.permalink);
  if (existing) {
    throw new Error(
      `CRITICAL: Duplicate permalink "${post.permalink}" detected between ` +
        `post "${existing}" and post "${post.id}". Build aborted.`
    );
  }
  seen.set(post.permalink, post.id);
}
```

Route-side normalization for reference:
`src/pages/[...slug].astro:11` strips only `^\/|\/$` from the route param,
and `src/config.yaml` requires trailing slash — so `/a/b` vs `a/b/` (and
case variants) converge at routing time but not in the `seen` map.

Repo conventions (`AGENTS.md` LAW-F5/F6, §3.3): permalink logic lives in
`src/utils/blog.ts` + `src/utils/permalinks.ts` (`trimSlash`, `cleanSlug`,
`getCanonical` — the winners, ~60 call sites). Route strings must never be
hand-rolled elsewhere. Content normalization belongs in this layer, not in
components. Existing test pattern: `tests/component/permalink.test.ts:135`
covers `getCanonical` (model new tests on its fixture style).

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

- `src/utils/blog.ts` (UTC getters; normalize explicit permalinks before
  return and before inserting into the `seen` map)
- `tests/blog-permalink.test.ts` (create — regression tests, see Test plan)

**Out of scope** (do NOT touch, even though they look related):

- `src/utils/permalinks.ts` — reuse `trimSlash`/`cleanSlug`, do not change them.
- `src/utils/date.ts` — already UTC; no change.
- Backend `publication_identity.py` — the backend half of date handling is
  plan 120 in the backend repo, not this plan.
- `src/config.yaml` trailing-slash setting — no change.

## Git workflow

- Branch: `advisor/011-permalink-utc`
- Commit per step; message style matches repo log, e.g.
  `fix(blog): generate permalinks in UTC and normalize duplicate check`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci`, then `npm run test:audit` on the unmodified checkout.

**Verify**: install exits 0; test suite passes.

### Step 1: Switch generatePermalink to UTC getters

In `src/utils/blog.ts`, replace the six local getters in
`generatePermalink` with their UTC counterparts (`getUTCFullYear`,
`getUTCMonth`, `getUTCDate`, `getUTCHours`, `getUTCMinutes`,
`getUTCSeconds`). Nothing else in the function changes.

**Verify**: `npm run test:audit` passes (existing tests must be
timezone-independent — if any existing test asserts a local-time
permalink, that test encodes the bug; STOP and report it rather than
"fixing" the test silently).

### Step 2: Normalize explicit permalinks and the duplicate key

1. In `resolvePostPermalink`, run an explicit `data.permalink` through the
   same normalization generated permalinks get (`trimSlash` from
   `~/utils/permalinks`, plus the existing `cleanSlug` segment handling)
   before returning it.
2. Key the `seen` map in the duplicate guard on the normalized permalink
   (normalize at the single point where `post.permalink` is assigned, so
   the map and the returned value cannot diverge).

**Verify**: `npm run test:audit` passes; new tests (Step 3) cover
`/salud/x` vs `salud/x/` colliding.

### Step 3: Add regression tests

Create `tests/blog-permalink.test.ts` covering:

1. A post dated `2026-01-31T00:00:00Z` generates a `/2026/01/31/...`
   permalink even when the process timezone is not UTC (set
   `process.env.TZ = 'Pacific/Kiritimati'` and `America/New_York` in two
   cases — or construct the date from an explicit UTC instant and assert
   the day segment).
2. Explicit permalinks `/salud/mi-post` and `salud/mi-post/` normalize to
   the same value.
3. Two posts whose permalinks differ only by leading/trailing slash trigger
   the fail-closed duplicate error (assert the build aborts, i.e. the
   function throws `CRITICAL: Duplicate permalink`).

Model structure on `tests/component/permalink.test.ts`.

**Verify**: `npx vitest run tests/blog-permalink.test.ts` — all new tests pass.

### Step 4: Full check

Run `npm run lint && npm run build && npm run test:dist`.

**Verify**: all exit 0. `test:dist` passing proves no live permalink shifted
(shape check: `git status` after build should show no unexpected
`dist/`-driven content diffs beyond the build itself; content files must
be untouched — `git diff --name-only -- src/content/` is empty).

## Test plan

- New `tests/blog-permalink.test.ts` with the 3 cases above (UTC day
  boundary under two timezones; slash-variant normalization; duplicate
  abort on slash-only differences).
- Existing `tests/component/permalink.test.ts` must keep passing unchanged.
- Verification: `npx vitest run tests/blog-permalink.test.ts` → all pass;
  full `npm run test:audit` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "getFullYear()\|getMonth()\|getDate()\|getHours()" src/utils/blog.ts` returns no matches (only `getUTC*` variants remain)
- [ ] `npx vitest run tests/blog-permalink.test.ts` — all pass (≥3 new tests)
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:dist` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only `src/utils/blog.ts`, `tests/blog-permalink.test.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- Any existing test asserts a local-timezone permalink (it encodes the bug).
- Normalizing explicit permalinks changes any live post's URL in
  `test:dist` output (that means a published permalink was non-canonical —
  report it; do not ship URL changes silently).
- The fix appears to require touching an out-of-scope file.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If a `draft`/scheduled-posts feature is ever added, the manifest/eligibility
  logic must use the same UTC day boundary — not `new Date()` local semantics.
- Reviewers: scrutinize that no other `getFullYear`-style local getters
  remain anywhere under `src/` (`grep -rn "getFullYear\|getMonth()" src/`).
- **Deferred:** backend `_parse_date_like` UTC normalization is the mirror
  half — tracked as backend plan 120, not this plan.
