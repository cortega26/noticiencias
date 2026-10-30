# ADR-0015: Compact full-text search index

- **Date**: 2026-10-29
- **Status**: Proposed

## Context

The full-text Lunr artifact exceeded the unchanged 150 KiB gzip budget at 58
articles: 155,870 bytes locally, matching the CI gzip measurement. Sampling five
body windows brought CI back under budget, but terms between those windows were
no longer searchable.

A same-corpus Pagefind prototype was also evaluated. Its first open-and-search
interaction transferred 196,425 estimated gzip bytes, the 20-query run
transferred 432,575 unique gzip bytes cumulatively, and two queries returned no
results where the full-text Lunr index returned articles. Its warm-search
median was 1.3 ms versus 1.2 ms for Lunr, so it did not meet the adoption
criterion.

## Decision

Use MiniSearch 7.2.0 for the static browser search index. Keep the existing
`/search.json` route, result-card store, lazy loading, and 150 KiB gzip ceiling.
Version 3 indexes complete normalized article bodies, titles, excerpts, and
tags. A shared Spanish stop-word filter removes common function words while
preserving negation. The browser loads MiniSearch only when search is used and
requests `/search.json?v=3` so an older cached v2 artifact is not reused by the
new client.

On the current 58-article corpus, v3 is 66,356 bytes gzip, 57.4% smaller than
the locally rebuilt full-text Lunr artifact. The index keeps the same top
result on all 19 queries where the full-text Lunr baseline returned a result;
the former zero-result `circónes` query finds the expected article. The hard
budget remains unchanged.

## Consequences

- Full article text remains searchable without per-article character caps.
- Search artifact, client, post-deploy validation, and tests use artifact
  version 3 and MiniSearch's serialized index format.
- The dependency is lazy-loaded in the browser; the result store remains
  separate from indexed body text.
- The artifact still grows with the corpus. Re-measure at the 135 KiB warning
  threshold and do not raise the 150 KiB ceiling without a separate decision.
- Search ranking is library-specific. The 20-query Spanish regression corpus
  is exercised by `tests/playwright/search.test.ts`; update it when its source
  articles are intentionally removed, and run it before changing fields,
  boosts, tokenizer, or stop-word list.

## Alternatives considered

| Option                         | Reason rejected                                                    |
| ------------------------------ | ------------------------------------------------------------------ |
| Keep bounded Lunr body samples | Loses searchable terms between selected windows.                   |
| Adopt Pagefind immediately     | Failed the same-corpus transfer, latency, and query-result checks. |
| Raise the gzip ceiling         | Hides index growth without reducing bytes delivered.               |
