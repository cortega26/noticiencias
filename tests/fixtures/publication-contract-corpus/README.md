# Publication Contract Corpus

**Version: v1**

This is the shared valid/invalid fixture set for the publication schema
contract defined in `src/content.config.ts`. It is used across plan 060:

- **Phase 0** (this phase) creates and commits it.
- **Phase 2** uses it to prove producer (backend) and consumer (frontend) v2
  field rejection. As of Phase 2b, this enforcement is unconditional — the
  `STRICT_EDITORIAL` flag referenced elsewhere in this document no longer
  exists in the codebase; see the v1 note under
  `v2-strict-failure-inventory.json` below for what it meant historically.
- **Phase 6** uses it to prove Zod / JSON Schema / Pydantic parity — the
  generated-contract work described in
  [`../../../docs/adr/0006-generate-contracts-instead-of-hand-maintained-parsers.md`](../../../docs/adr/0006-generate-contracts-instead-of-hand-maintained-parsers.md).

## Versioning rule

New fixtures require a **version bump** in this README plus a note below
describing what was added and why. Existing fixture files are **frozen**
once other phases start depending on them — do not silently edit an existing
fixture's content in place. If a fixture turns out to be wrong, add a new
one and note the correction here; do not rewrite history that Phase 2/6
tooling may already be pinned against.

### v1 (2026-08-22, plan 060 Phase 0)

Initial corpus. Contents:

- `valid/v1-complete.json` — synthetic, schema-version-1 object exercising
  the non-v2 fields in `src/content.config.ts` (lines 10-48). Two fields in
  that range are deliberately omitted: `featured_rank` (line 46), because
  the `superRefine` cross-field check at lines 94-99 only requires it when
  `featured: true` and this fixture sets `featured: false`; and
  `uncertainty_note` (line 48), because `requires_uncertainty_note` is
  `false` here (no cross-field requirement forces it, unlike
  `image_alt`/`featured_rank`).
- `valid/v2-complete.json` — real frontmatter transcribed verbatim (not
  paraphrased) from
  `src/content/posts/2026-08-12-un-modelo-de-ia-realizo-mas-de-17-500-acciones-en-hugging-face.md`,
  the one currently-passing, complete v2 post.
- `invalid/v2-missing-*.json` (6 files) — `valid/v2-complete.json` with
  exactly one required v2 field removed each: `summary_points`, `glossary`,
  `fact_check`, `why_it_matters`, `confidence`, `sources`.
- `invalid/v2-empty-summary-points.json` — `summary_points: []`, violating
  the 2-5 item minimum.
- `invalid/v2-too-many-summary-points.json` — `summary_points` with 6 items,
  violating the max-5 constraint.
- `edge-cases/date-formats.json` — a bare JSON array of real `date:` string
  values observed across `src/content/posts/*.md` at generation time (via
  `grep -h '^date:' src/content/posts/*.md | sort -u`). Only one format was
  found in the current corpus: bare, unquoted `YYYY-MM-DD` (10 characters,
  no time component) — e.g. `"2026-01-15"`, `"2026-01-17"`, `"2026-08-12"`.
  This is a deviation from what the plan anticipated ("a few date-string
  variants"): the live corpus has exactly one variant, so that is what is
  recorded, per the rule against inventing values that aren't observed.
- `edge-cases/source-objects.json` — a bare `sources` array (matching the
  shape of `src/content.config.ts`'s `sources` field, lines 70-79) exercising
  the optional `publisher`/`date` fields on a source object: one entry with
  only `title`+`url`, one with all four fields.
- `edge-cases/defaults.json` — an object omitting every field that carries a
  `.default(...)` in `src/content.config.ts`, to characterize
  default-application behavior.
- `edge-cases/additional-property-stripped.json` — a valid `v2-complete.json`
  plus one unknown top-level field, characterizing Zod's default
  **stripping** behavior for unrecognized keys — see "Known design gap"
  below.
- `v2-strict-failure-inventory.json` — the JSON output of
  `STRICT_EDITORIAL=true node scripts/check-editorial-fields.js --json` run
  against `src/content/posts/` at frontend commit `582ed40` (the ADR commit;
  two commits precede this file's own addition and one follows it, but
  nothing in this corpus's work touches `src/content/posts/`, so `errors[]`
  is identical at all of them), with a `_generated_at_commit` key added on
  top of the tool's own output. This is Phase 2's human-content-review
  migration input; its `errors[]` array is recorded as-is, unedited.
  **Historical note (Plan 060 / Phase 2b):** `STRICT_EDITORIAL` gated
  strict/informational behavior at the time this fixture was generated; the
  flag has since been removed and `check-editorial-fields.js` now always
  runs in the mode this record captured. This frozen fixture's command line
  is left as originally run, per this document's versioning rule.

## No in-file annotations on schema-instance fixtures

Every fixture that represents a publication-schema instance (everything
under `valid/`, `invalid/`, plus `edge-cases/defaults.json` and
`edge-cases/additional-property-stripped.json`) contains **only** real
`src/content.config.ts` field keys — no `_fixture_note`/`_fixture_source`-style
annotation keys. Explanatory prose lives here in the README instead. This
matters structurally: the schema being characterized silently strips unknown
top-level keys (see "Known design gap" below), so an annotation key inside a
fixture would itself be an instance of that stripping behavior, corrupting
fixtures whose entire purpose is something else — most acutely
`valid/v2-complete.json` (would no longer be a verbatim transcription) and
`edge-cases/additional-property-stripped.json` (`not_a_real_field` must be
the _only_ unknown key present, or the fixture stops isolating one variable).
`v2-strict-failure-inventory.json` is the sole exception: it is recorded tool
output, not a schema instance, and the plan explicitly directs adding
`_generated_at_commit` on top of it.

## Known design gap: additional-property handling

`src/content.config.ts`'s top-level object schema has no `.strict()` or
`.passthrough()` call (confirmed via
`grep -n "\.strict()\|\.passthrough()" src/content.config.ts` — no matches).
Zod's default therefore applies: unknown top-level keys in frontmatter are
**silently stripped** during parsing, not rejected as a validation error.
`edge-cases/additional-property-stripped.json` characterizes this behavior
so it is visible and testable, but it is a live, unresolved design question
this corpus does not itself answer — should unrecognized publication fields
be rejected (`.strict()`), explicitly allowed through (`.passthrough()`), or
remain silently stripped (current default)? Phase 6, when it builds the
generated JSON Schema / Pydantic parity comparison, must decide this
explicitly rather than inherit the current default by omission, since a
generated schema's handling of unknown properties may not match Zod's
default unless configured to.

## Placeholder conventions

Synthetic fixtures use `https://example.com/...` URLs, consistent with how
this repo's other test fixtures use `example.com` for placeholder sources.
No fabricated real-world sources, fact checks, glossary entries, or
confidence levels appear in any fixture — see plan 060's evidence-baseline
rule against inventing editorial content.
