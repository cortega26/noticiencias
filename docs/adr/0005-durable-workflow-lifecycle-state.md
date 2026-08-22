# ADR-0005: Backend Durable Workflow-Lifecycle State (Frontend Reference)

- **Date**: 2026-08-22
- **Status**: Proposed

## Context

The backend (`noticiencias_news_collector`) is the caller of this repo's
publication surface: it writes MDX files into `src/content/posts/` and
receives/emits publication-attempt signals as part of its ingest and
publishing pipeline. Today, publication-attempt identity and callback
reconciliation on the backend side are not durable — restarting the backend
process can lose in-flight state, and there is no queryable record of "did
this publication attempt land, and what happened to it."

Plan 060 (backend Phase 5) introduces durable, queryable workflow-lifecycle
tables on the backend to fix this. Backend ADR-0006
(`../../../noticiencias_news_collector/docs/adr/0006-durable-workflow-lifecycle-state.md`)
is the canonical record of that decision, including the table/field design.
This frontend ADR exists only so a reader of this repo's `docs/adr/`
understands _why_ backend publication-attempt IDs are becoming stable and
reconcilable, without needing to cross into the backend repo first.

## Decision

Frontend has no schema changes of its own for this decision. `src/content.config.ts`
(the sealed cross-repo contract, see ADR-0003) is unaffected: the durable
workflow-lifecycle tables live entirely on the backend side of the boundary
and govern how the backend tracks its own publication attempts, retries, and
callback reconciliation — not the shape of the MDX/frontmatter contract this
repo consumes.

This repo's contribution to the durability story is indirect: the strict
editorial failure inventory and the publication-contract fixture corpus
built in this same phase (see Step 3 of `plans/060/phase-0-baseline/spec.md`
in the backend repo) give the backend's new durable pipeline a fixed,
versioned target to validate against once it starts writing v2-enriched
posts more reliably.

## Consequences

- Frontend readers now have a pointer explaining why backend publication IDs
  become stable/reconcilable, without duplicating backend implementation
  detail here.
- No frontend code, schema, or CI behavior changes as a result of this ADR.
- Future backend work referencing "the durable workflow-lifecycle tables"
  should be understood as backend ADR-0006's scope, not this repo's.

## Alternatives considered

| Option                                                          | Reason rejected                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Skip a frontend ADR entirely, rely on backend ADR-0006 alone    | Frontend-only readers of this repo's `docs/adr/` would have no local pointer to why backend IDs changed                           |
| Mirror the backend's table/field schema in this ADR             | Duplicates backend ADR-0006's authoritative content; risks drifting out of sync as backend design evolves                         |
| Add frontend schema fields to expose backend workflow state now | Premature — no consumer in this repo needs workflow-lifecycle state yet; would violate the sealed-contract discipline in ADR-0003 |
