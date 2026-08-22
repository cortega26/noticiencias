# Publication Contract Corpus

**Version: v1**

This is the shared valid/invalid fixture set for the publication schema
contract defined in `src/content.config.ts`. It is used across plan 060:

- **Phase 0** (this phase) creates and commits it.
- **Phase 2** uses it to prove producer (backend) and consumer (frontend) v2
  field rejection under `STRICT_EDITORIAL=true`.
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

### v1 (2026-08-22, plan 060 Phase 0, frontend commit `582ed40`)

Initial corpus. Contents:

- `valid/v1-complete.json` — synthetic, schema-version-1 object exercising
  every non-v2 field in `src/content.config.ts` (lines 10-48).
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
- `edge-cases/date-formats.json` — real `date:` string formats observed
  across `src/content/posts/*.md` at generation time (one format found:
  bare `YYYY-MM-DD`).
- `edge-cases/source-objects.json` — `sources` array exercising the optional
  `publisher`/`date` fields on a source object.
- `edge-cases/defaults.json` — an object omitting every field that carries a
  `.default(...)` in `src/content.config.ts`, to characterize
  default-application behavior.
- `edge-cases/additional-property-stripped.json` — a valid `v2-complete.json`
  plus one unknown top-level field, characterizing Zod's default
  **stripping** behavior for unrecognized keys — see "Known design gap"
  below.
- `v2-strict-failure-inventory.json` — the JSON output of
  `STRICT_EDITORIAL=true node scripts/check-editorial-fields.js --json` run
  against `src/content/posts/` at frontend commit `582ed40`, with a
  `_generated_at_commit` key added on top of the tool's own output. This is
  Phase 2's human-content-review migration input; its `errors[]` array is
  recorded as-is, unedited.

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
