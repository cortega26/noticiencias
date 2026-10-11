# Plan 015: Characterization tests for the untested core (blog, metadata, dist-sanity, images)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- vitest.config.ts src/utils/blog.ts src/components/template/common/Metadata.astro scripts/dist-sanity.js src/utils/image-derivatives.ts src/utils/images-optimization.ts src/utils/images.ts tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (lands before/after plans 011/013 independently;
  if 011 already added `tests/blog-permalink.test.ts`, extend it instead
  of creating a competing file)
- **Category**: tests
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

The repo's reason-to-exist path — backend Markdown → validated Post →
permalinked routes → SEO metadata — is its least-tested code. `blog.ts`
carries the LAW-F6 normalization contract at 55/32/36 coverage floors;
the shared Metadata path is covered only at dist level (a full build to
catch a title regression); the 681-line `dist-sanity.js` gate has no
direct test (a bug in the checker false-passes a broken `dist/`); the
image pipeline sits at 0–40% with recent churn on the same surface. These
are characterization tests: pin current behavior first so refactors
(plans 011, 013, 017) have a fast signal. Test-only changes, no production
code.

## Current state

Facts (verified 2026-10-11):

- `vitest.config.ts:100-125` pins per-file floors, including:
  - `'src/utils/blog.ts': { statements: 55, branches: 32, functions: 36, lines: 59 }` (lowest non-zero)
  - `'src/utils/image-derivatives.ts': { 40, 33, 45, 40 }`
  - `'src/utils/images-optimization.ts'`, `'src/utils/images.ts'`,
    `'src/pages/llms*.ts'`, `'src/integration/index.ts'`: all `0` —
    deliberately kept in the denominator per the comment citing
    `plans/031/spec.md` ("Accepted gaps ... not chased in this pass").
- No `tests/blog.test.ts` exists; only
  `tests/component/permalink.test.ts:135` covers `getCanonical`.
- `src/components/template/common/Metadata.astro` (the LAW-mandated SEO
  path: page → layout → Metadata.astro) has no unit test; coverage is
  dist-only (`tests/quick-wins-regression.test.ts:176-188` canonical,
  `tests/article-hero-rendering.test.ts:127` og:image,
  `tests/json-ld.test.ts` serializer only).
- `scripts/dist-sanity.js` (681 lines: route resolution, image-src
  resolvability, AVIF/default-image guards) runs only via `npm run
test:dist` after a real build; its sibling
  `scripts/post-deploy-check-lib.js` has `tests/post-deploy-check.test.ts`
  (the pattern to copy: export pure classifiers, unit-test with fixtures).
- Image area: only `tests/image-delivery-mode.test.ts:47` (mode flag) plus
  dist-level hero checks exercise it.
- Playwright fixed waits (flakiness source):
  `tests/playwright/lifecycle.test.ts:167`, `tests/playwright-consent/consent.test.ts:254`
  (`waitForTimeout(300)`), `tests/playwright/newsletter.test.ts:17`
  (`setTimeout(...,1000)`).
- Otherwise healthy (do not "fix"): zero `toMatchSnapshot` uses;
  `tests/date.test.ts:28-40` uses relative dates correctly.

Repo conventions: tests live in `tests/` as Vitest files; `post-deploy-check.test.ts`
is the structural pattern for script-classifier tests; `make test-audit`-equivalent
here is `npm run test:audit` (`vitest run`).

## Commands you will need

| Purpose  | Command                       | Provenance | Expected on success |
| -------- | ----------------------------- | ---------- | ------------------- |
| Install  | `npm ci`                      | declared   | exit 0              |
| Unit     | `npm run test:audit`          | declared   | all pass            |
| Focused  | `npx vitest run tests/<file>` | declared   | pass                |
| Coverage | `npm run test:coverage`       | declared   | report; floors hold |

## Scope

**In scope** (the only files you should modify/create):

- `tests/blog.test.ts` (create; if plan 011 already created
  `tests/blog-permalink.test.ts`, put permalink edge cases there and keep
  normalization cases here — do not create two files testing the same function)
- `tests/metadata-assembly.test.ts` (create — canonical/OG assembly feeding Metadata.astro)
- `tests/dist-sanity.test.ts` (create — may require small pure-function
  exports from `scripts/dist-sanity.js`; that edit is in scope)
- `tests/image-derivatives.test.ts` (create — manifest load/miss, variant
  resolution, strict-mode branches)
- `vitest.config.ts` (raise `blog.ts` + `image-derivatives.ts` floors ONLY
  to the levels the new tests actually achieve — measure, don't guess)
- The three Playwright fixed waits (replace with event/load-state waits)

**Out of scope** (do NOT touch, even though they look related):

- Production code beyond the minimal `dist-sanity.js` exports.
- The `0`-floor accepted-gap files (`images-optimization.ts`, `images.ts`,
  `llms*.ts`, `integration/index.ts`) — raising those is a separate
  decision (the ledger cites `plans/031/spec.md`); do not chase them here.
- Backend `make test-*` suites — different repo, different plans.

## Git workflow

- Branch: `advisor/015-characterization-tests`
- Commit per test file; e.g. `test(blog): characterize permalink fallback and fail-closed guards`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci` and `npm run test:audit` on the unmodified checkout. Check
whether `tests/blog-permalink.test.ts` exists (plan 011 may have landed).

**Verify**: suite green; you know which permalink file (if any) to extend.

### Step 1: blog.ts characterization tests

Create `tests/blog.test.ts` pinning `resolvePostPermalink` /
`getNormalizedPost` edge cases: permalink fallback when no explicit
permalink, empty-slug and empty-title fail-closed aborts, category/tag
normalization, duplicate-permalink abort. (If 011 landed, skip its covered
cases and reference that file in a comment.)

**Verify**: `npx vitest run tests/blog.test.ts` — all pass. The tests must
fail if the guards are removed (spot-check by temporarily commenting one
guard — then restore; record that you did this in the commit message).

### Step 2: Metadata assembly tests

Add unit coverage for the canonical/OG assembly that feeds
`Metadata.astro`, so `test:audit` catches title/description/canonical
regressions without a build. Test the helpers, not the Astro component
renderer (keep it fast and non-flaky).

**Verify**: new test file passes; `test:audit` passes.

### Step 3: dist-sanity classifier tests

Export the pure classifiers from `scripts/dist-sanity.js`
(`resolvePostRoute`/image-classification helpers — minimal export-only
edit, no logic change) and unit-test them with fixture frontmatter/HTML
in `tests/dist-sanity.test.ts`, modeled on
`tests/post-deploy-check.test.ts`.

**Verify**: `npm run test:dist` still passes unmodified in behavior (the
export edit must not change gate output — run it before/after on the same
build); new tests pass.

### Step 4: Image-derivative unit tests

Unit-test `loadImageDerivativeManifest` / `resolveDerivativeVariants` /
`selectPreferredVariantSrc` (manifest miss, variant resolution, strict-mode
`IMAGE_DERIVATIVES_REQUIRE_URL=1` branches) with temp-dir fixtures.
Then raise the `vitest.config.ts` floors for `blog.ts` and
`image-derivatives.ts` to the measured achieved values.

**Verify**: `npm run test:coverage` — new floors hold; no other floor touched.

### Step 5: Replace fixed Playwright waits

Replace `waitForTimeout(300)` (lifecycle, consent) and the
`setTimeout(...,1000)` (newsletter) with load-state/event-based waits.

**Verify**: `npx playwright test` on the affected specs passes (if browsers
are unavailable in this environment, run the typecheck/lint on the edited
specs and mark the e2e run as operator-verified in the commit message —
do not claim an unverified pass).

## Test plan

- New files: `tests/blog.test.ts`, `tests/metadata-assembly.test.ts`,
  `tests/dist-sanity.test.ts`, `tests/image-derivatives.test.ts`.
- Each file must contain at least one test that fails on the pre-fix/buggy
  behavior (mutation spot-check per Step 1 — apply to one case per file).
- Verification: `npm run test:audit` all pass; `npm run test:coverage`
  floors hold.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The four new test files exist and pass under `npx vitest run tests/`
- [ ] `npm run test:audit` exits 0
- [ ] `npm run test:coverage` exits 0 with raised `blog.ts` floors holding
- [ ] `npm run test:dist` exits 0 (export edit behavior-neutral)
- [ ] No `waitForTimeout(300)` / fixed `setTimeout` remains in the three Playwright specs
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `dist-sanity.js` internals are not cleanly exportable without logic changes
  (report the shape; don't refactor the script to fit the test).
- Raising a coverage floor fails because the tests don't actually cover the
  file (lower the floor to measured reality and report, don't weaken tests to pass).
- Playwright browsers are unavailable AND the spec edits are non-trivial
  (report as operator-verified instead of guessing).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- These are the characterization tests plans 011/013/017 rely on — keep
  them fast (`vitest run`, no build) and behavior-pinning, not
  implementation-pinning (don't assert on private helpers).
- **Deferred:** the `0`-floor accepted-gap files stay at 0 by ledger
  decision (`plans/031/spec.md`) — do not expand this plan to chase them.
