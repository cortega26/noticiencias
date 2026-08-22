# ADR-0007: Harden the Two-Repo Boundary Before Reconsidering Consolidation

- **Date**: 2026-08-22
- **Status**: Proposed

## Context

Backend ADR-0003
(`../../noticiencias_news_collector/docs/adr/0003-two-repo-split-and-schema-versioning.md`,
reference only) already decided to keep two repositories —
`noticiencias_news_collector` (backend) and `noticiencias` (this repo,
frontend) — connected by a contract-mirror pattern: this repo's
`src/content.config.ts` (sealed cross-repo contract, this repo's own
ADR-0003) on one side, the backend's Pydantic contract on the other, kept in
sync today by `scripts/check-contract-sync.js` (see ADR-0006).

Plan 060's evidence baseline shows real, measured pain in the current
system: v2 posts failing strict editorial validation (30 of 31 v2 posts, 180
errors, all missing the same six required fields — see the strict editorial
failure state re-verified for this phase), admin state that does not survive
a backend restart, and callback/reconciliation gaps in publication tracking.
None of that evidence traces to the repository boundary itself. It traces to
_unenforced contracts and missing durable state_ — problems that phases 1-10
of plan 060 (including this repo's ADR-0005 and ADR-0006) directly address
without touching where the repo split sits.

## Decision

This ADR does not reverse or supersede backend ADR-0003, nor this repo's own
ADR-0003 (content-schema-contract). It records an explicit sequencing
decision: harden contracts, durable state, and observability first — across
all phases of plan 060 — then, and only then, measure actual cross-repo
coordination overhead for at least one full release window and write an
evidence-based keep-split-or-consolidate decision. That measurement and
decision is master plan Phase 11's scope, not this phase's.

Reconsidering consolidation before that measurement window completes is a
listed program-wide STOP condition in the master plan. Any future proposal
to merge these two repositories before Phase 11's evidence-gathering window
closes should be treated as out of sequence with this decision, not as a
routine architectural choice.

## Consequences

- No repository restructuring, monorepo migration, or build-tooling change
  happens as a result of this ADR, now or as a near-term consequence of it.
- Contract-hardening work (ADR-0005, ADR-0006, and the fixture corpus built
  in Step 3 of this phase) proceeds on the assumption that the two-repo
  boundary is stable for the duration of plan 060.
- Phase 11's eventual keep-split-or-consolidate decision inherits a cleaner
  evidence baseline: by the time that measurement window starts, the
  reliability gaps visible today (unenforced v2 fields, non-durable admin
  state, callback gaps) will already be addressed or in progress, so any
  remaining coordination overhead measured then is attributable to the
  repo-boundary itself rather than to these known, separately-fixed defects.
- Anyone proposing consolidation work before Phase 11 completes should be
  pointed at this ADR and the master plan's STOP-condition list.

## Alternatives considered

| Option                                                                    | Reason rejected                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consolidate into a monorepo now                                           | Premature, and explicitly out of scope per the master plan ("A big-bang monorepo move or framework/language rewrite"); would also confound Phase 11's measurement by removing the boundary before its overhead is ever measured              |
| Do nothing / leave ADR-0003 (both repos) as the last word on the boundary | The evidence baseline shows real, measured reliability gaps (strict editorial failures, non-durable admin state, callback reconciliation gaps) that need addressing regardless of eventual repo shape; silence would leave those unaddressed |
| Measure coordination overhead now, before hardening                       | Would measure overhead dominated by known, already-diagnosed defects (unenforced contracts, non-durable state) rather than by the repo boundary itself, producing a misleading signal for the Phase 11 decision                              |
