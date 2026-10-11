# Plan 018: Fix stale frontend doc pointer (OPERATOR_PENDING ADR ref)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- docs/OPERATOR_PENDING.md scripts/check-doc-drift.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

`docs/OPERATOR_PENDING.md` §3.2 directs the operator to record the plan-048
≥200-record enrichment decision in `docs/adr/0004-*`. In this repo,
`docs/adr/0004-npm-over-pnpm.md` is about npm-vs-pnpm — the actual decision
record lives in the backend repo at
`../noticiencias_news_collector/docs/adr/0004-curated-enrichment-registry-spike.md`.
The operator completing the only gated enrichment decision lands on an
unrelated ADR. Worse, `scripts/check-doc-drift.js` never checks this file,
so the error persists silently (and the `*` glob makes it unscannable).

## Current state

- `docs/OPERATOR_PENDING.md:71-78` (verified 2026-10-11):
  ```text
  ### 3.2 Plan 048: decisión del registry de enriquecimiento (≥200 registros)
  ...
  - Verificación: decisión registrada en `docs/adr/0004-*` y baseline
    comparable en `reports/evaluation/`.
  ```
- Frontend `docs/adr/0004-npm-over-pnpm.md` exists (wrong target).
- Backend `docs/adr/0004-curated-enrichment-registry-spike.md` exists
  (right target, different repo).
- `scripts/check-doc-drift.js:46-61` `DEFAULT_DOC_FILES` lists 12 files;
  `docs/OPERATOR_PENDING.md` is absent. Every other frontend cross-repo
  reference uses the `../noticiencias_news_collector/` prefix — §3.2 is
  missing it.

## Commands you will need

| Purpose | Command                   | Provenance | Expected on success |
| ------- | ------------------------- | ---------- | ------------------- |
| Drift   | `npm run check:doc-drift` | declared   | exit 0              |
| Lint    | `npm run lint`            | declared   | exit 0              |

## Scope

**In scope**:

- `docs/OPERATOR_PENDING.md` (§3.2 pointer fix)
- `scripts/check-doc-drift.js` (add `docs/OPERATOR_PENDING.md` to `DEFAULT_DOC_FILES`)

**Out of scope**:

- Backend ADR content — read-only reference.
- Any other OPERATOR_PENDING section (GA4 checklist etc. — operator-owned).
- Drift-check logic changes beyond the file-list addition.

## Git workflow

- Branch: `advisor/018-operator-pending-pointer`
- One commit, e.g. `docs(operator): point plan-048 decision at backend ADR-0004`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

Run `npm run check:doc-drift` on the unmodified checkout.

**Verify**: exits 0.

### Step 1: Fix the pointer and gate the file

1. Change the §3.2 verification line to point at
   `../noticiencias_news_collector/docs/adr/0004-curated-enrichment-registry-spike.md`.
   First verify that backend file still exists at that path (read-only
   `ls`); if it moved, STOP and report.
2. Add `docs/OPERATOR_PENDING.md` to `DEFAULT_DOC_FILES` in
   `scripts/check-doc-drift.js`. If the `*` glob in the OPERATOR_PENDING
   file breaks the drift scanner, fix the scanner's handling minimally or
   scope the file's checked invariants — report which you chose.

**Verify**: `npm run check:doc-drift` exits 0 with the file included;
the pointer resolves to a real file.

## Test plan

- No new tests. `check:doc-drift` green with the newly-gated file is the verification.
- If the repo has a drift-gate test (`tests/check-doc-drift.test.ts`
  exists per the tests/ listing), run it: `npx vitest run tests/check-doc-drift.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "0004-\*" docs/OPERATOR_PENDING.md` returns no matches
- [ ] `grep -n "OPERATOR_PENDING" scripts/check-doc-drift.js` returns a match
- [ ] `npm run check:doc-drift` exits 0
- [ ] `npm run lint` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only the two in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The backend ADR file moved (pointer target dead — report, don't guess).
- The drift scanner cannot handle the file's glob content (report the
  scanner limitation rather than silently excluding the file again).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Cross-repo ADR pointers rot when either repo renumbers; prefer links to
  stable ADR filenames (as done here), never to `0004-*` globs.
