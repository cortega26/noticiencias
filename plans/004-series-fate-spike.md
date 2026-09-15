# Plan 004: Spike the fate of Series — remove the placeholder or feed it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- src/content.config.ts src/utils/blog.ts src/pages/series/ src/pages/index.astro src/components/common/DailyDesk.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S (spike: usage audit + priced recommendation; removal build is S, activation build is M cross-repo)
- **Risk**: LOW (spike writes no source changes; recommendation only)
- **Depends on**: none (soft: plan 003's traffic data would strengthen the readership case, but the placeholder decision stands on its own)
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The site ships a full Series feature — schema field, index page, per-series
route, homepage-adjacent positioning ("seguir una historia con
continuidad") — with zero posts using it, so readers who find `/series/`
meet a "Próximamente" placeholder. A dead surface that promises continuity
is worse than no surface: it spends the investigative brand without
delivering it. Either the feature earns its keep (backend emits `series`,
editors curate sequences) or it should be removed honestly. This spike
prices both paths and recommends exactly one.

## Current state

The facts the executor needs, inlined:

- Usage: `grep -l "^series:" src/content/posts/*.md` returns **0 files**
  (verified at planning time against the full corpus). Re-run this first —
  if nonzero, the premise shifted (see STOP).
- Schema carries the field: `src/content.config.ts:79` — `series: z.string().optional()`.
- Index page with placeholder: `src/pages/series/index.astro:1-54`.
  It collects `post.data.series` into `seriesList` and renders:

  ```astro
  {seriesList.length === 0 ? (
      <p class="text-center text-gray-500 col-span-full">
        Próximamente: Nuevas series en desarrollo.
      </p>
    ) : ( /* cards linking to `/series/${cleanSlug(series)}` */ )}
  ```

- Detail route builds zero pages today: `src/pages/series/[series].astro:8-28`
  (`getStaticPaths` reduces `fetchPosts()` by `post.series`; with no series
  set, it returns `[]`). Its metadata (`[series].astro:32-39`) is
  index/follow — note for the removal path: deleting the route removes no
  indexed URLs today, but confirm via sitemap check in Step 2.
- Positioning copy at stake: index page header promises "Lecturas agrupadas
  para seguir una historia científica o tecnológica con más continuidad."
  (`[series].astro` equivalent in `index.astro:30-32`).
- Backend angle: the sibling backend repo (`../noticiencias_news_collector/`)
  owns taxonomy/series emission; the frontend only consumes. Activation is
  therefore cross-repo (LAW-F1-adjacent: `series` value vocabulary would
  need a contract, mirroring how `docs/tagging.md` governs tags).
- Repo conventions: LAW-F2 (route responsibilities), LAW-F6 (normalization
  before rendering — series slugs already go through `cleanSlug` in both
  series files, keep it that way in either path).

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Baseline lint | `npm run lint` | declared | exit 0 |
| Baseline content validation | `npm run validate:content` | declared | exit 0 |
| Audit suite | `npm run test:audit` | declared | all pass |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor. Broken on unmodified checkout → STOP, report, don't fix.

## Scope

**In scope** (the only files you should modify):
- `plans/README.md` (status row + recording the recommendation — the spike
  deliverable lives in the index, not a new file; see Step 3)

**Out of scope** (do NOT touch):
- `src/pages/series/*`, `src/content.config.ts`, `src/utils/blog.ts` —
  removal or activation is the later build's job.
- Backend repo — read-only inspection allowed (`../noticiencias_news_collector/`
  taxonomy dirs) to price activation, but change nothing there.
- Nav/header files — do not add or remove series links in a spike.

## Git workflow

- Branch: `advisor/004-series-fate-spike`
- Commit style: conventional (e.g. `docs: spike series fate recommendation (plan 004)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm run lint`, `npm run validate:content` unmodified. **STOP and
report** (command + output) on any failure.

**Verify**: both exit 0.

### Step 1: Re-run the usage audit

Run: `grep -l "^series:" src/content/posts/*.md | wc -l`, plus
`grep -rn "series" src/pages/index.astro src/components/common/DailyDesk.astro src/utils/hub.ts`
to map every consumer of the concept (homepage rails? hub selection? nav?).

**Verify**: usage count recorded (expected 0). If count > 0, **STOP and
report** — series is being fed and this spike's premise is answered (say
which files use it).

### Step 2: Price both paths concretely

- **Path A (remove)**: list exact files to delete/change (series pages,
  schema field?, `Post` type propagation in `src/utils/blog.ts` + `src/types.d.ts`,
  sitemap/robots references if any — check `astro.config.mjs` sitemap filter
  and `public/robots.txt` for `series`), plus redirect decision for
  `/series/` (gone entirely vs. redirect to `/blog/`). Check tests
  referencing series (`grep -rn "series" tests/`) and list affected specs.
- **Path B (activate)**: inspect (read-only) the backend taxonomy emission
  for a series-like concept; define the minimal contract (who sets `series`,
  vocabulary control, min posts per series before the index shows it —
  propose ≥3 so the page never shows singletons); estimate frontend-only
  work (index redesign for empty→populated states, `[series].astro` SEO
  copy) separately from backend work.

**Verify**: both paths have file lists + test impact + coarse effort (S for
A; M cross-repo for B). No code changed.

### Step 3: Record the recommendation in `plans/README.md`

Write a one-paragraph verdict (A or B with the deciding reason — e.g.
editorial capacity for curation, traffic evidence if plan 003 has landed)
plus the priced file lists from Step 2, in the findings/recommendations
area of `plans/README.md`. This IS the deliverable — no ADR needed for a
binary product call at this scale.

**Verify**: `npm run test:audit` passes; `git diff --name-only` shows only
`plans/README.md`.

## Test plan

No production code changes, no new tests. For the later build (whichever
path): removal must assert `grep -rni "series" src/pages/ src/utils/blog.ts src/content.config.ts`
returns only intended survivors + sitemap has no `/series/` URLs
(`npm run build && npm run test:dist`); activation must add a content-shape
test mirroring `tests/content-config-schema.test.ts` for the series
contract. Name these in the README note so the build plan inherits them.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run test:audit` all exit 0 / pass
- [ ] Current `series:` usage count recorded in `plans/README.md` with the verdict (remove or activate) + priced file lists for both paths
- [ ] Later-build test hooks named (removal grep assertion / activation schema test)
- [ ] `git diff --name-only 8af478b...HEAD` lists only `plans/README.md`
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report (do not improvise) if:

- "Current state" excerpts don't match live code (drift).
- `series:` usage count > 0 (premise answered — report what uses it).
- Verification fails twice after reasonable fix attempts.
- Recommending requires touching out-of-scope files.
- A `declared` command is missing/broken on the unmodified checkout.

## Maintenance notes

- If Path A wins: the `series` schema field removal is a LAW-F1
  cross-repo touch (backend must not emit it) — coordinate, don't just delete.
- If Path B wins: series vocabulary needs a `docs/tagging.md`-style
  contract before content flows, or the index fills with near-duplicate
  series names.
- Reviewer scrutiny: sunk-cost bias ("we built it, keep it") vs. the
  placeholder's brand cost — the usage count is the tiebreaker.
- **Deferred:** series-aware homepage rail — only if Path B ships and at
  least 2 series reach ≥3 posts each.
