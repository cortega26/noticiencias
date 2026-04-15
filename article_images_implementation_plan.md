# Article Images Implementation Plan

## Goal 1 — Fetch and fix missing article images

### Step 1: Source image extraction

Ran `image_extractor.extract_candidates()` against all 4 non-editorial source URLs:

| Source               | Result                                                 |
| -------------------- | ------------------------------------------------------ |
| theconversation.com  | Valid OG image (JPEG, 1356×668) — downloaded ✓         |
| aws.amazon.com       | Valid OG image (PNG, 1120×630) — downloaded ✓          |
| lilianweng.github.io | No OG tag; only local relative figure images — skipped |
| techxplore.com       | HTTP 403 — skipped                                     |

### Step 2: Image download

Saved to `src/assets/images/` using Content-Type–derived extension:

- `src/assets/images/2026-03-27-el-error-de-redondeo.jpg` (64 KB, 1356×668)
- `src/assets/images/2026-03-26-como-los-llm.png` (313 KB, 1120×630)

### Step 3: Frontmatter update

Updated `image:` field in two articles:

- `src/content/posts/2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md`
- `src/content/posts/2026-03-26-como-los-llm-aprenden-a-dominar-tus-documentos-la-clave-esta-en-el-finetuning-con-datos-no-estructurados.md`

### Step 4: Pipeline fix (news_collector)

Added one missing line to `news_collector/collectors/rss_collector.py` line ~928:

```python
"image_url": raw_article.get("image_url"),
```

This ensures every future article processed through the refinery has its source image downloaded and included in the published markdown. Committed as `321b67e`.

---

## Goal 2 — AVIF pipeline upgrade

### AVIF strategy decision

| Option                               | Decision   | Reason                                                                                                      |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------- |
| AVIF as sole `srcset` format         | ✓ Chosen   | ~96% global browser support (Chrome 85+/2020, Firefox 86+/2021, Safari 16+/2022); `sharp` already installed |
| AVIF + WebP fallback via `<picture>` | Not chosen | Would require refactoring `Image.astro` from `<img>` to `<picture><source>` — disproportionate for <4% gain |
| WebP only (status quo)               | Not chosen | AVIF is 30–50% smaller than WebP at equivalent quality                                                      |
| No conversion                        | Not chosen | Wastes bandwidth; sharp already handles it for free at build time                                           |

**Fallback strategy**: The existing `<img src="...original.jpg">` attribute already serves as implicit fallback — browsers that don't support AVIF ignore `srcset` and use `src`. No architecture change required.

### Step 1: Wire `config.defaultFormat` in `astroAssetsOptimizer`

**Problem**: `config.formats` array in `images-optimization.ts` was declared but never consumed. The `format` parameter of `astroAssetsOptimizer` defaulted to `undefined`, so Astro's default (WebP when sharp is present) was used.

**Fix**: Changed `images-optimization.ts`:

```diff
- defaultFormat: 'webp' as const  // (was: formats: ['image/webp'])
+ defaultFormat: 'avif' as const
```

```diff
- format = undefined
+ format = config.defaultFormat
```

The OG image path (`images.ts` line 116) explicitly passes `'jpg'` — unaffected.

### Step 2: Add `.avif` to `fetchLocalImages` glob

Updated `images.ts` glob to include `avif,AVIF` so any hand-placed AVIF source files are discovered by Astro's image pipeline.

### Step 3: Improve `_download_image` extension detection (news_collector)

Replaced URL heuristic with Content-Type header resolution:

```python
ct = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
ext = _CT_TO_EXT.get(ct)  # e.g. "image/webp" → ".webp", "image/avif" → ".avif"
# URL heuristic only as fallback when Content-Type is absent/unknown
```

This correctly handles images served from CDNs with complex URLs (query strings, no extension in path).

---

## Verification

```
# Lint — 27 files, 0 errors, 0 warnings
npm run lint → Hero image check passed for 27 files. ✓

# Build — clean cache
rm -rf dist node_modules/.astro && npm run build
→ 139 pages built ✓
→ 207 AVIF files generated in dist/_astro/ ✓
→ 0 build errors ✓

# AVIF in rendered HTML
grep srcset dist/ciencia/2026-03-27-.../index.html
→ srcset contains *.avif at all 15 breakpoints (640w–6016w) ✓
→ src="...original.jpg" fallback present ✓

# New article images render
2026-03-27-el-error-de-redondeo.avif: 64KB source → 7KB@640w … 70KB@6016w AVIF ✓
2026-03-26-como-los-llm.avif: 313KB source → 10KB@640w AVIF ✓
```

### Compression gains (representative samples)

| Source                                | Format | Source size | 1080w AVIF     |
| ------------------------------------- | ------ | ----------- | -------------- |
| `2026-03-27-el-error-de-redondeo.jpg` | JPEG   | 64 KB       | 15 KB (-77%)   |
| `2026-03-26-como-los-llm.png`         | PNG    | 313 KB      | ~18 KB (-94%)  |
| `2026-02-18-849.jpg`                  | JPEG   | 245 KB      | 3 KB (-99%)    |
| `2026-01-17-article-213.png`          | PNG    | 1.9 MB      | ~200 KB (-89%) |
