# Plan 016: Fix DX gates that don't gate (lint-staged, typecheck, duplicate CI work)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- package.json .husky/ .github/workflows/deploy.yml .github/workflows/content-guard.yml .env.example AGENTS.md README.md eslint.config.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

Four paper cuts that each push failures to the slowest possible feedback
point: commits touching TS/JS/Astro run zero pre-commit checks (lint-staged
covers only Markdown); there is no fast `npm run typecheck` (types hide
inside the multi-minute `validate:content`); `verify:ci` runs the same ~13
content-check scripts twice; every push pays full `validate:content` in a
pre-push hook, training developers to `--no-verify`; deploy/guard workflows
repeat `npm ci` 3×/3×. None is hard; together they decide whether the gates
get used or bypassed. Pure config/script recomposition, no behavior change.

## Current state

Facts (all verified 2026-10-11):

- `package.json:86-99` `lint-staged` stanzas match only `*.md`,
  `src/content.config.ts`, `src/content/posts/*.md`. `.husky/pre-commit`
  runs only `npx lint-staged` → TS/JS/Astro commits get zero checks.
- No `typecheck`/`tsc` script at root (`package.json:9-50` enumerated);
  `astro check` runs only inside `validate:content` after 13 content
  scripts. `tsconfig.json` extends `astro/tsconfigs/strict` (ready).
  In-repo precedent: `workers/package.json:10` has
  `"typecheck": "tsc --noEmit"`.
- `package.json:34` (`lint`) and `:49` (`validate:content`) both run the
  same 13 node check scripts; `:50` chains `lint && validate:content &&
  build …` → every check executes twice per `verify:ci`.
- `.husky/pre-push` runs `npm run validate:content` (13 checks + `astro
  sync` + `astro check` + freeze) on every push.
- `deploy.yml:35,57,127` — `gate`, `package`, `deploy` jobs each run fresh
  `npm ci`. `content-guard.yml:40,136,166` — three `npm ci` runs
  (`validate`, `build`, + one more at :166).
- `eslint.config.mjs:17-28` ignores `workers/`; root `lint`/`verify:ci`
  never exercise worker checks — but `content-guard.yml`'s PR `build` job
  does run the worker suite, so the gap is discovery, not enforcement.
- `AGENTS.md:20-36` §0.5 omits `verify:ci`, `test:e2e`,
  `test:e2e:consent`, `test:visual`, `check:search-budget`; `README.md:33-53`
  likewise omits `verify:ci` (both otherwise accurate).
- `.env.example:19-30` documents `BACKEND_WEBHOOK_URL` but not
  `BACKEND_WEBHOOK_TOKEN` (required by `content-guard.yml:97` and
  `deploy.yml:146`); `NOTICIENCIAS_GA_ID` (set inline by
  `build:consent-fixture`, `package.json:47`) has no entry.

## Commands you will need

| Purpose   | Command                  | Provenance | Expected on success |
|-----------|--------------------------|------------|---------------------|
| Install   | `npm ci`                 | declared   | exit 0              |
| Lint      | `npm run lint`           | declared   | exit 0              |
| Content   | `npm run validate:content` | declared | exit 0              |
| Hooks     | `npx lint-staged` (on fixtures) | declared | exit 0        |

## Scope

**In scope** (the only files you should modify):

- `package.json` (lint-staged stanza, `typecheck` script, shared
  `check:content` extraction)
- `.husky/pre-push` (fast subset)
- `.github/workflows/deploy.yml`, `.github/workflows/content-guard.yml`
  (fold gate steps / share workspace — see Step 4)
- `.env.example` (two commented entries)
- `AGENTS.md` §0.5/§7, `README.md` Development block (command lists)

**Out of scope** (do NOT touch, even though they look related):

- Check script logic — recomposition only; output must stay identical.
- `workers/` lint config — document the exclusion, don't rewire it
  (a root passthrough script is allowed: `"lint:workers": "npm --prefix
  workers run typecheck"` — additive only).
- Backend `Makefile`/workflows — different repo (backend plan 129).

## Git workflow

- Branch: `advisor/016-dx-gates`
- Commit per step; e.g. `chore(dx): cover TS/Astro in lint-staged`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci` and `npm run lint` on the unmodified checkout. Time a full
`npm run verify:ci`-equivalent mentally — do not run it (slow); the
per-step verifications below compose it.

**Verify**: install + lint green.

### Step 1: Cover TS/JS/Astro in lint-staged + add typecheck

1. Add a lint-staged stanza for `*.{ts,js,mjs,astro}` running
   `prettier --check` and scoped `eslint --no-warn-ignored` on staged files.
2. Add `"typecheck": "astro check"` to `package.json` scripts and reference
   it from `AGENTS.md` §0.5/§7.

**Verify**: stage a fixture TS file with a formatting error, run
`npx lint-staged`, confirm it flags; `npm run typecheck` exits 0 on the
clean tree. (First run may flag pre-existing violations — if it does,
report them; do not bulk-fix unrelated files. Fixing the fixture only.)

### Step 2: Dedupe lint vs validate:content

Extract a shared `check:content` script holding the 13 node check scripts
once; `lint` = content + format/eslint, `validate:content` = content +
`astro sync/check` + freeze. Diff the output of the old and new
compositions on the clean tree (list of executed commands must be
identical modulo the removed duplication).

**Verify**: `npm run lint` and `npm run validate:content` both exit 0;
executed-check list identical except deduped.

### Step 3: Slim the pre-push hook

Move full validation to CI-only: pre-push runs the fast subset
(`lint-staged`-on-diff or `npm run lint`). CI (`content-guard.yml`)
already runs the full gate on push, so no coverage is lost.

**Verify**: `.husky/pre-push` no longer invokes `validate:content`;
`content-guard.yml` still does (unchanged).

### Step 4: Collapse redundant npm ci in workflows

Fold the pre-publish gate steps into the `package` job before build (or
share one installed workspace via artifacts) in `deploy.yml`; same for
`validate`+`build` in `content-guard.yml`. Keep `needs:` chains and
artifact semantics identical; keep failure granularity (a gate failure
must still fail the workflow with the same message).

**Verify**: workflow YAML parses (`node --check` on extracted JS is N/A —
use `npx prettier --check` on the YAML-adjacent files per repo lint +
`npm run lint`); dry-review the `needs:` graph in the PR description. Risk
is MED here — if the restructure is not cleanly expressible, do the
minimal version (fold `gate` into `package` only) and report the rest as
deferred.

### Step 5: Docs and env-example updates

1. Add the five missing commands to `AGENTS.md` §0.5 and the README
   Development block (`verify:ci`, `test:e2e`, `test:e2e:consent`,
   `test:visual`, `check:search-budget`).
2. Add commented `# BACKEND_WEBHOOK_TOKEN=` (noting it lives in GitHub
   Secrets, like the Cloudflare block) and `# NOTICIENCIAS_GA_ID=` entries
   to `.env.example` (placeholder values must not be secret-shaped).
3. Note the `workers/` lint exclusion + worker commands in `AGENTS.md` §7
   (or add the additive `lint:workers` passthrough).

**Verify**: `npm run check:doc-drift` stays green (it maps scripts↔docs).

## Test plan

- No new test files. Verification is gate-equivalence: same checks run,
  same outputs, less wall time.
- Record `verify:ci` wall-clock before/after in the final commit message
  (measure once each if time permits; otherwise state it as unmeasured).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx lint-staged --help` config covers `*.{ts,js,mjs,astro}` (read from `package.json`)
- [ ] `npm run typecheck` exists and exits 0
- [ ] `cat .husky/pre-push` does not contain `validate:content`
- [ ] `grep -c "npm ci" .github/workflows/deploy.yml` ≤ 2 (was 3); content-guard reduced similarly
- [ ] `npm run check:doc-drift` exits 0
- [ ] `npm run lint` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- Step 1 surfaces pre-existing violations (report; don't bulk-fix).
- Step 4's job-merge cannot preserve failure granularity (do minimal version + report).
- `check:doc-drift` fails after the docs edits (fix the mapping, don't weaken the gate).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- If new script entrypoints are added to `package.json`, update §0.5 in the
  same PR (`check:doc-drift` enforces the mapping).
- **Deferred:** sharing one installed workspace across deploy jobs via
  artifacts (M variant) — done only if the S fold proves insufficient.
