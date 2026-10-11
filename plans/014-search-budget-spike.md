# Plan 014: Search-budget triage spike (measure, decide, do NOT migrate yet)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- src/utils/build-search-index.ts scripts/check-search-budget.js src/utils/browser/search-index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

`search.json` embeds full post content into the serialized Lunr index that
every search user downloads and deserializes on the main thread. The repo's
own budget gate (`check-search-budget.js`) records ~3.4 KB gzip per post
against a 150 KB ceiling, with an explicit trigger: when the gate fails,
migrate to Pagefind (or slim the store) — never silently raise the ceiling.
A prior ledger decision ("Migrate off Lunr: not worth doing now",
`plans/README.md` rejected list) closed an *ungrounded* migration; this
spike does not relitigate it. It re-measures, quantifies runway, and
produces the evidence the trigger clause asks for, so the maintainer's next
decision is data, not pressure. No migration ships in this plan.

## Current state

Facts (verified 2026-10-11):

- `src/utils/build-search-index.ts:116-126` indexes full stripped `content`
  per doc into the serialized Lunr index:
  ```ts
  const index = lunr(function (this: lunr.Builder) {
    this.ref('url');
    this.field('title', { boost: 10 });
    this.field('description', { boost: 5 });
    this.field('content');
    this.field('tags');
  ```
- `scripts/check-search-budget.js` header documents the trigger (plan 114,
  measured 2026-09-16): 122,047 bytes gzip at 36 posts (~3.4 KB/post); the
  150 KB ceiling binds within ~10 new posts. "When this gate fails, migrate
  the browser search to Pagefind (or slim the store) in a dedicated plan —
  never raise GZIP_CEILING silently to make it pass." A later "Stream C
  slim" note (2026-09-21) dropped per-doc `image` URLs and truncated
  descriptions to 160 chars at build time — re-measurement after that slim
  is the open item.
- Browser runtime loads Lunr via dynamic `import()` on first use only
  (`src/utils/browser/search-index.ts:46`, `HeaderSearch.astro:264,293`) —
  composition is already disciplined; artifact size, not bundling, is the
  leverage point.
- Standing decisions this spike must honor: frontend `plans/README.md`
  rejected "migrate off Lunr" as ungrounded (revisit on evidence — this
  spike *is* the evidence pass); backend plan 080 defers Pagefind; plan 114
  records the trigger without migrating.

## Commands you will need

| Purpose   | Command                  | Provenance | Expected on success |
|-----------|--------------------------|------------|---------------------|
| Install   | `npm ci`                 | declared   | exit 0              |
| Budget    | `npm run check:search-budget` | declared | exit 0 (or the measured failure — see Step 1) |
| Build     | `npm run build`          | declared   | exit 0              |
| Unit      | `npm run test:audit`     | declared   | all pass            |

## Scope

**In scope** (the only files you should modify):

- `scripts/check-search-budget.js` (only if the re-measurement shows the
  Stream-C slim changed the accounting comments — update comments/numbers,
  never the ceiling)
- `docs/` note or `reports/` entry recording the verdict (one short file —
  check `docs/` for the existing search-budget note location first and
  extend it rather than creating a competing doc)
- Nothing else. Especially: no index-format change, no Pagefind, no
  `GZIP_CEILING` change.

**Out of scope** (do NOT touch, even though they look related):

- Migrating to Pagefind/Orama — explicitly out; that is a future dedicated plan.
- Raising `GZIP_CEILING` — forbidden by the gate's own charter.
- Slimming the indexed `content` field — that is a *recommendation* this
  spike may produce, not work it performs (it changes ranking behavior and
  needs relevance checks).
- `lunr` version changes (kept deliberately; see plan 010 maintenance notes).

## Git workflow

- Branch: `advisor/014-search-budget-spike`
- One commit expected; e.g. `chore(search): re-measure index budget after Stream-C slim`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci` and `npm run check:search-budget` on the unmodified checkout.
Record: gzip bytes, post count, bytes/post, remaining headroom in posts.

**Verify**: you have four numbers written down (bytes, posts, bytes/post, headroom).

### Step 1: Re-measure after the Stream-C slim

Run `npm run build` then `npm run check:search-budget` again. Compare
against the Step-0 numbers and the 2026-09-16 baseline (122,047 bytes @
36 posts). Determine: did the image/store slim materially change the
per-post slope? How many posts of headroom remain at current cadence
(~3 posts/week)?

**Verify**: a short table (before/after/slope/headroom-weeks) exists in
your working notes; if the gate now FAILS, that is a finding to report,
not to fix by touching the ceiling — STOP and report it as the headline.

### Step 2: Write the verdict

Record in the existing search-budget doc/note (or a short `reports/`
entry if none exists): the four numbers, weeks-of-runway at current
cadence, and exactly one of three recommendations: (a) headroom healthy —
revisit in N posts with the number stated; (b) trigger near — scope the
content-field slimming plan (title/description/tags + snippet retrieval)
with relevance-check requirements; (c) trigger firing — scope the
Pagefind migration plan honoring plan 080's deferral. Update the
`check-search-budget.js` header comment numbers if they are stale (numbers
only — never the ceiling constant or trigger semantics).

**Verify**: `npm run check:search-budget` still exits as in Step 1 (your
comment edit must not change gate behavior); `npm run test:audit` passes
(the budget test in `tests/check-search-budget.test.ts` must be unaffected).

## Test plan

- No new tests (measurement spike). Existing `check-search-budget` gate
  and its test are the verification that nothing moved.
- Verification: gate exit status identical before/after; header numbers
  match measured reality.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check:search-budget` exit status unchanged by this plan
- [ ] `npm run test:audit` exits 0
- [ ] A written verdict (numbers + runway + one of the three recommendations) exists in docs/reports
- [ ] `GZIP_CEILING` value is untouched (`git diff` shows no change to the constant)
- [ ] `git diff --name-only a37798c...HEAD` lists only the budget script header (if touched) + the verdict note
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The budget gate FAILS on the unmodified checkout (trigger firing — the
  verdict becomes "scope the migration plan now" and you should report
  rather than continue measuring).
- Any pressure (test output, convenience) suggests raising the ceiling —
  that is forbidden; report it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Re-run this measurement every ~10 published posts (the gate enforces it
  anyway when it binds).
- **Deferred:** Pagefind migration (needs plan 080's deferral lifted +
  this spike's evidence); content-field slimming (needs relevance checks).
  Both are named follow-ups with owners (maintainer decision), unblocked
  by nothing but the trigger firing.
