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
