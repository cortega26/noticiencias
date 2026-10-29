# Plan 014 verdict: search-budget triage spike (2026-10-11)

Measurement-only spike. No migration, no ceiling change, no production-code change.

## Numbers (measured `npm run build` + `npm run check:search-budget`, exit 0)

|                              | 2026-09-16 baseline  | 2026-10-11 (post Stream-C slim)                            |
| ---------------------------- | -------------------- | ---------------------------------------------------------- |
| gzip bytes                   | 122,047              | 147,274                                                    |
| posts (entries)              | 36                   | 43                                                         |
| avg bytes/post               | ~3,390               | ~3,425                                                     |
| marginal slope (7 new posts) | —                    | ~3,604/post                                                |
| raw bytes                    | —                    | 1,956,530                                                  |
| ceiling (150 KB)             | 153,600              | 153,600 (untouched)                                        |
| headroom                     | ~28.5 KB (~10 posts) | 6,326 bytes (~1.8 posts)                                   |
| WARN (135 KB = 138,240)      | below                | crossed by 9,034 bytes (warning prints, gate still passes) |

## Findings

- The Stream-C slim (drop per-doc `image` URLs, truncate descriptions to
  160 chars) did **not** materially change the per-post slope: marginal
  ~3.6 KB/post vs baseline ~3.4 KB/post. Growth is dominated by the full
  stripped `content` field indexed into the serialized Lunr artifact
  (`build-search-index.ts:116-126`, unchanged).
- Headroom at ~3 posts/week cadence: **~2 posts, i.e. under one week**.
- Gate still passes (exit 0), so this is NOT the firing trigger — no STOP,
  no emergency migration.

## Verdict: (b) trigger near

Scope the content-field slimming plan (title/description/tags +
snippet retrieval) **with relevance-check requirements** — slimming changes
ranking behavior and must prove no search-quality regression before it
ships. The Pagefind migration stays deferred per plan 080 until the gate
actually fails.

Re-measure every ~10 published posts at most — realistically, re-measure on
the next post publish, since the ceiling binds within ~2 posts.

## Trigger response: bounded Lunr content (2026-10-29)

The gate later failed on the exact head of frontend PR #376,
`72a507985b84e975be4a3a27dc974067a706a522`: 155,870 gzip bytes for 58 posts,
2,270 bytes above the unchanged 153,600-byte ceiling. To keep Lunr and avoid
raising that ceiling, long post bodies now contribute five evenly spaced
windows totaling at most 2,800 characters. Titles, excerpts, and tags remain
fully indexed; article pages are unchanged.

| Measurement | PR head before | Bounded content build |
| ----------- | -------------: | --------------------: |
| Posts       |             58 |                    58 |
| Raw bytes   |   825,109 (CI) |               684,003 |
| Gzip bytes  |   155,870 (CI) |               128,897 |
| Ceiling     |        153,600 |               153,600 |
| Headroom    |         -2,270 |                24,703 |

Reproduced locally with Node 24.19.0 and npm 11.17.0 using `npm run build` and
`npm run check:search-budget`. The final artifact passes with 58 entries;
gzip size is 17.3% below the failing PR artifact. The search-content tests
verify queries in the beginning and evenly spaced later parts of long bodies,
and verify title, excerpt, and tag searches remain available. A smoke check on
the new article found `teghaza`, `manganeso`, `acuosa`, `estratigrafia`, and
`heterogeneo` in its results.

This bounds the artifact while keeping distributed body coverage; terms that
occur only between sampled windows may no longer match unless they also occur
in a title, excerpt, or tag. The 150 KiB gate remains unchanged.
