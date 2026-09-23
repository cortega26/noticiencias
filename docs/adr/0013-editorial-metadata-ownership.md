# ADR-0013: Editorial metadata ownership (featured, series, topics)

- **Date**: 2026-09-23
- **Status**: Accepted

## Context

The 2026-09 editorial/UX program left three metadata gaps tracked as open
follow-ups:

- `featured` / `featured_rank`: the frontend schema and the home ranking
  already consume editor curation, but the publication pipeline never emits
  the fields, so the hero falls back to the newest stories (FU-014).
- Series and topic descriptions live in frontend maps
  (`src/utils/series.ts`, `src/utils/topics.ts`) because the publication
  contract carries only the series/tag names (FU-016, FU-021).

Without a boundary decision these gaps reopen implicitly every time the home
or a hub is touched.

## Decision

1. **Featured is backend-owned.** The frontend keeps consuming
   `featured` / `featured_rank` when present. Until the pipeline (or an
   editorial tool) emits them, the hero uses the documented fallback —
   investigation preference, then newest. No frontend curation workaround:
   no title lists or per-post overrides in code.
2. **Series and topic descriptions stay as frontend maps** until the
   publication contract carries first-class series/topic metadata. The maps
   are versioned with the site, reviewed like code, and have a neutral
   fallback for unknown entries; a new series or topic without a description
   uses the fallback instead of inventing copy.
3. **Revisit triggers**: a first-class content model for series/topics, or a
   backend editorial capability that sets `featured`. Either one is its own
   spec and must retire the corresponding map in the same change.

## Consequences

- FU-014, FU-016 and FU-021 close as accepted boundaries, not open debt.
- Any future contract field for series/topics updates `src/content.config.ts`
  (LAW-F1) and the backend mirror, then removes the frontend map in the same
  change.
- The home keeps degrading gracefully when curation metadata is absent; the
  fallback is product behavior, not a temporary hack.
