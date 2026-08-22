# ADR-0006: Generate Contracts Instead of Hand-Maintained Parsers/Mirrors

- **Date**: 2026-08-22
- **Status**: Proposed

## Context

Two cross-repo contract surfaces are currently kept in sync by hand-written
tooling rather than generated from a single source of truth:

- `scripts/check-contract-sync.js` (this repo, frontend) is a 1,488-line
  regex parser that reads both the backend's Pydantic contract
  (`news_collector/contracts/frontend_schema.py`) and this repo's Zod schema
  (`src/content.config.ts`) as text, and compares field shapes structurally.
  It is the mechanism verified in Step 0/2 of this phase
  (`npm run sync:contract-snapshot`, `node scripts/check-contract-sync.js --strict`).
- `apps/admin/src/lib/types.ts` and `api.ts`, in the **backend** repo
  (`noticiencias_news_collector/apps/admin/src/lib/`), are — per plan 060's
  evidence baseline — a handwritten TypeScript mirror of the backend's admin
  HTTP API, with `api.ts` casting response JSON to those hand-written types.
  This repo does not itself have an `apps/admin/` directory; this ADR is
  written from the frontend's vantage point about a drift-detection gap that
  spans the boundary, not about code that lives here.

Both are measured drift-detection gaps: a regex parser can silently diverge
from either language's actual type grammar as either schema evolves, and a
handwritten API-response mirror has no mechanical guarantee it still matches
what the backend's FastAPI app actually serves.

## Decision

Adopt native, documented generation instead of hand-maintained
parsers/mirrors, in two places:

1. **Admin HTTP contract** (backend-owned surface): generate from FastAPI's
   `app.openapi()` / Pydantic's `BaseModel.model_json_schema()`, and drive
   TypeScript client generation from that OpenAPI document via
   `openapi-typescript`, replacing the handwritten `apps/admin/src/lib/types.ts`
   mirror with generated types and a typed client (`openapi-fetch`).
2. **Publication/content structural contract** (this repo's authority, per
   ADR-0003): generate a neutral JSON Schema from this repo's Zod schema
   using Zod 4's `z.toJSONSchema()`, and compare it against the backend's
   Pydantic-derived JSON Schema on the shared valid/invalid fixture corpus
   built in Step 3 of this phase
   (`tests/fixtures/publication-contract-corpus/`), rather than relying only
   on `check-contract-sync.js`'s regex-based structural comparison.

`check-contract-sync.js` is **not** deleted by this ADR. It keeps running as
the enforced gate (see Step 0/2 verification above) until generated-schema
parity has been proven for one full release window. Retirement is explicitly
scheduled for master plan Phase 6, not this phase.

Reference implementations:

- FastAPI OpenAPI generation and `app.openapi()`: https://fastapi.tiangolo.com/how-to/extending-openapi/
- Pydantic `BaseModel.model_json_schema()`: https://docs.pydantic.dev/latest/concepts/json_schema/
- Astro content collection schema behavior: https://docs.astro.build/en/reference/modules/astro-content/
- Zod 4 JSON Schema conversion: https://zod.dev/json-schema
- `openapi-typescript` CLI: https://openapi-ts.dev/cli
- typed `openapi-fetch` client: https://openapi-ts.dev/openapi-fetch/

## Consequences

- Once implemented (Phase 6), contract drift between backend and frontend
  becomes a generation-and-diff problem instead of a hand-maintenance
  problem — both the admin HTTP surface and the publication structural
  surface get a single generated source of truth per side, compared
  mechanically.
- Until Phase 6 lands, `check-contract-sync.js` remains load-bearing; this
  ADR does not change its behavior or reduce reliance on it today.
- The shared fixture corpus from Step 3 of this phase becomes the parity
  proof surface for Phase 6 — new fixtures added later must follow that
  corpus's versioning rule (see its `README.md`) or parity proofs against it
  become untrustworthy.
- This ADR does not change which repo owns which contract: frontend Zod
  remains publication-input authority (ADR-0003), FastAPI/Pydantic remains
  admin-HTTP-contract authority. Generation changes _how_ each side's
  authoritative shape is exposed for comparison, not _which_ side is
  authoritative.

## Alternatives considered

| Option                                                                           | Reason rejected                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep the hand-maintained regex parser and handwritten admin API mirror           | Proven drift risk — both are measured gaps in plan 060's evidence baseline; neither has a mechanical guarantee of staying in sync with the schemas/APIs they mirror                                                                       |
| Generate the frontend Zod schema from the backend Pydantic model (or vice versa) | Inverts the ownership rule already established in backend ADR-0003: frontend Zod is publication-input authority, FastAPI/Pydantic is admin-HTTP-contract authority. This ADR implements ADR-0003's next step; it does not change ADR-0003 |
| Delete `check-contract-sync.js` immediately and cut over                         | Removes the only currently-enforced gate before generated-schema parity is proven; this phase changes no CI gates (see Scope) and Phase 6 owns the cutover, after a compatibility window                                                  |
