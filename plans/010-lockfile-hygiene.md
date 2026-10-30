# Plan 010: Patch sharp RCE and clean the frontend lockfile pass

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- package.json package-lock.json astro.config.mjs scripts/publish-image-derivatives.js scripts/utils/image-derivatives.js src/utils/images-optimization.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

`npm audit` flags `sharp <0.35.5` as HIGH (librsvg use-after-free, possible
RCE on glibc Linux). Sharp is reachable build/runtime code in this repo
(Astro config, the image-derivatives publisher, the optimizer), processing
contributor-supplied images on Linux CI/build hosts. The fix is a patch bump
with no API change. While touching the lockfile, this plan also takes the
free non-breaking `npm audit fix` items and removes one dead dependency, so
the tree ends with zero HIGH advisories and no invalid peer entries.

## Current state

Relevant files and roles:

- `package.json` — dependency manifest. Current excerpts (verified 2026-10-11):
  - line 64: `"astro": "~7.2.8"` (tilde pins 7.2.x; upstream 7.3.x exists)
  - line 65: `"astro-embed": "^0.13.0"` (dead — see below)
  - line 73: `"sharp": "^0.35.4"` (vulnerable range)
  - lines 78–85: `overrides` for `lodash`, `yaml`, `fast-uri`,
    `brace-expansion`, `esbuild` (`esbuild` pinned to exactly `0.28.1`)
- `package-lock.json` — resolves `sharp` at `0.35.4`; `astro-embed` at
  `0.13.0` with a peer complaint (`npm ls` reports
  `astro@7.2.10 invalid: "^5.0.0 || ^6.0.0-alpha" from node_modules/astro-embed`).
- `astro-embed` usage: a repo-wide search for `astro-embed` outside
  `package.json`/`package-lock.json` hits only
  `docs/migration/TEMPLATE_DIFF.md:12` (a documentation mention). Zero code
  imports. It was never verified against Astro 7.
- `npm audit --omit=dev --audit-level=high` additionally reports HIGH items
  with non-breaking fixes available: `devalue <=5.9.2` (via astro),
  `http-cache-semantics <=4.2.0` (via astro/vite fetch caching), and
  `source-map-js 1.0.0–1.2.1` (via tailwind/vite/css-tree chains). The one
  `--force` item (`postcss-selector-parser`, MODERATE) is out of scope.

Repo conventions to follow: dependency changes are a Critical-class change
per `AGENTS.md` §9 — run the full validation chain
(`lint`, `validate:content`, `build`, `test:dist`, `test:audit`). Commit
style follows the log, e.g. `chore: update pipeline metrics`,
`fix(enrichment): honor discovery_only per source`.

## Commands you will need

| Purpose | Command                                   | Provenance | Expected on success           |
| ------- | ----------------------------------------- | ---------- | ----------------------------- |
| Install | `npm ci`                                  | declared   | exit 0                        |
| Audit   | `npm audit --omit=dev --audit-level=high` | declared   | exit 0, zero HIGH (after fix) |
| Lint    | `npm run lint`                            | declared   | exit 0                        |
| Content | `npm run validate:content`                | declared   | exit 0                        |
| Build   | `npm run build`                           | declared   | exit 0                        |
| Dist    | `npm run test:dist`                       | declared   | exit 0                        |
| Unit    | `npm run test:audit`                      | declared   | all pass                      |

## Scope

**In scope** (the only files you should modify):

- `package.json` (four edits: sharp bump, astro-embed removal, astro range widen)
- `package-lock.json` (regenerated)

**Out of scope** (do NOT touch, even though they look related):

- `src/`, `scripts/`, `workers/` code — no behavior changes in this plan.
- The `esbuild: 0.28.1` override — evaluate only (Step 3); do not remove
  blindly if `npm ls esbuild` still shows a vulnerable copy after upgrade.
- `docs/migration/TEMPLATE_DIFF.md:12` — historical migration note mentioning
  astro-embed; leave it as history.
- Any `--force` audit fix (postcss-selector-parser, MODERATE) — out of scope.

## Git workflow

- Branch: `advisor/010-lockfile-hygiene`
- Commit per logical unit; message style matches repo log (`chore: ...`,
  e.g. `chore: bump sharp to ^0.35.5 and prune dead astro-embed`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

On the unmodified checkout, run `npm ci`, then `npm audit --omit=dev
--audit-level=high` (record the HIGH list — expect sharp + the transitive
items above), then `npm run lint`. Do not run the full build yet (slow);
build health is verified after the change.

**Verify**: `npm ci` exits 0; audit output matches the Current-state list
(4 HIGH groups); `npm run lint` exits 0.

### Step 1: Bump sharp to ^0.35.5

Edit `package.json` line 73: `"sharp": "^0.35.4"` → `"sharp": "^0.35.5"`.
Run `npm install --package-lock-only` (or `npm update sharp`) to relock
without a full install, then `npm ci`.

**Verify**: `npm ls sharp` shows ≥0.35.5; `npm audit --omit=dev
--audit-level=high` no longer lists sharp.

### Step 2: Apply free non-breaking audit fixes

Run `npm audit fix` (no `--force`). Commit the lockfile change separately
from Step 1 so a regression bisects cleanly.

**Verify**: `npm audit --omit=dev --audit-level=high` exits 0 with no HIGH
items. If any HIGH remains that requires `--force`, STOP and report it —
do not force.

### Step 3: Remove astro-embed and widen the astro range

1. Run `npm uninstall astro-embed` (removes the `package.json:65` line and
   prunes `~10 @astro-community/astro-embed-*` subpackages from the lock).
2. Edit `package.json:64`: `"astro": "~7.2.8"` → `"astro": "^7.2.8"`,
   then relock (`npm install --package-lock-only` + `npm ci`).
3. Evaluate the `esbuild: 0.28.1` override: run `npm ls esbuild`. If the
   tree no longer needs the pin (Astro 7.3.x moved off direct esbuild
   dependence), leave the override in place anyway — removing overrides is
   a separate decision. Just record the `npm ls esbuild` output in the
   commit message body.

**Verify**: `grep -rn "astro-embed" src/ scripts/ workers/ --include='*.ts' --include='*.js' --include='*.astro' --include='*.mjs'` returns no matches;
`npm ls` shows no `invalid:` peer lines; `npm run build` exits 0.

### Step 4: Full validation chain

Run `npm run lint && npm run validate:content && npm run build &&
npm run test:dist && npm run test:audit`.

**Verify**: every command exits 0; `test:audit` shows all tests passing.

## Test plan

- No new tests to write (dependency-only change).
- Existing suites are the verification: `test:dist` covers the
  image-derivative output sharp produces; `test:audit` covers regressions.
- Pattern reference: none needed (no test file changes).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm audit --omit=dev --audit-level=high` exits 0 with zero HIGH advisories
- [ ] `npm ls sharp` shows ≥0.35.5
- [ ] `npm ls` shows no `invalid:` peer entries
- [ ] `npm run lint` exits 0
- [ ] `npm run validate:content` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:dist` exits 0
- [ ] `npm run test:audit` exits 0, all pass
- [ ] `git diff --name-only a37798c...HEAD` lists only `package.json` and `package-lock.json`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- `npm audit fix` wants `--force` for any HIGH item.
- `npm uninstall astro-embed` or the astro range widen breaks `npm run build`
  (possible if something imports astro-embed dynamically — search first).
- A command marked `declared` does not exist or fails on the unmodified
  checkout (Step 0) — the baseline is broken; report it rather than repairing it.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Re-run `npm audit --omit=dev --audit-level=high` monthly; the repo has no
  automated audit cadence and HIGHs have landed silently before.
- **Deferred:** the `esbuild: 0.28.1` exact override will age into dead
  weight on Astro 7.3.x — revisit (keep vs drop) once the 7.3 line is
  stable, unblocked by nothing.
- **Deferred in 010; superseded 2026-10-29:** `lunr@2.3.9` was kept at the
  time because it had no known CVEs. ADR-0015 later replaces it with
  MiniSearch v3 after the full-text search artifact exceeded its budget.
