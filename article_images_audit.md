# Article Images Audit

## Current Image Pipeline

### Collection (news_collector)
1. RSS feed entry → `rss_parser.py` extracts `image_url` from `media:content` / `enclosures` / `media:thumbnail`
2. `rss_collector.extract_items()` validates feed image; if missing, runs `image_extractor.extract_candidates()` on fetched HTML
3. `image_extractor` uses three layers: OG/Twitter meta tags (score 10), DOM heuristics (score 1–3), blacklist filtering
4. Validated candidate stored in `article_metadata.image_url` (field was missing until fix `321b67e`)
5. On refinery run: `refinery_engine._download_image()` fetches URL, saves to `<astro_repo>/src/assets/images/{slug}.{ext}`, updates `article["image_url"]` to `~/assets/images/{slug}.{ext}`
6. `ai_editor.process_article()` writes `image: {path}` into markdown frontmatter

### Site (Astro)
1. `src/content/posts/*.md` frontmatter field `image: "~/assets/images/{filename}"`
2. `PostLayout.astro` passes `imageSrc` to `Image.astro` component
3. `Image.astro` → `findImage()` resolves path via `import.meta.glob` → `astroAssetsOptimizer` → `getImage()` (sharp)
4. Generates AVIF variants at all device breakpoints (640w … 6016w) as `srcset`
5. Original format (JPEG/PNG) passed as `src` fallback for non-AVIF browsers
6. `<img srcset="...avif 640w, ...avif 750w, ..." src="...original.jpg">`

---

## Affected Articles

| Article | Source URL | Failure Mode | Root Cause |
|---------|-----------|--------------|------------|
| `2026-03-27-el-error-de-redondeo...` | theconversation.com/... | `default.png` shown | `image_url` never stored in `article_metadata` (pipeline bug); and preamble leak left article without proper image |
| `2026-03-26-como-los-llm...` | aws.amazon.com/... | `default.png` shown | Same pipeline bug |
| `2024-07-07-la-paradoja...` | lilianweng.github.io/... | `default.png` shown | Same pipeline bug; source has no OG image — static blog with only local relative figures |
| `2026-02-15-publicidad...` | techxplore.com/... | `default.png` shown | Same pipeline bug; source returns 403 Forbidden |
| `2026-02-12-bienvenidos.md` | internal editorial | `default.png` intentional | No external source; editorial page |
| `2026-02-12-salud-bienvenida.md` | internal editorial | `default.png` intentional | No external source; editorial page |

---

## Confirmed Root Causes

### Root Cause 1 — `image_url` not persisted (systemic, fixed in 321b67e)
In `rss_collector._process_article()` (line ~922), when constructing `article_metadata`, the validated `image_url` field was never included. All other pipeline pieces were implemented and wired correctly:
- `image_extractor.py` extracted images ✓
- `adapters.adapt_article_to_export()` read `article_metadata.get("image_url")` ✓
- `refinery_engine` downloaded the URL and updated frontmatter ✓
- `ai_editor` wrote `image:` to YAML ✓

One missing line broke the entire chain.

### Root Cause 2 — No guardrail on published articles (fixed in b3dda74)
No lint/CI check caught articles published with missing `image` fields. Now enforced by `scripts/check-hero-images.js`.

### Root Cause 3 — Source-level limitations (2 articles, not fixable automatically)
- **Lilian Weng blog**: No OG image tag; only local relative figures in article body — not appropriate hero images
- **TechXplore**: Returns HTTP 403 regardless of headers — access blocked

---

## Where the Break Occurs

```
rss_collector.extract_items()        ← image_url validated here ✓
rss_collector._process_article()     ← image_url DROPPED here ✗ (was root cause)
adapters.adapt_article_to_export()   ← reads article_metadata.get("image_url") ✓
refinery_engine._download_image()    ← downloads & saves ✓
ai_editor.process_article()          ← writes frontmatter ✓
```

---

## Systemic vs Article-Specific

| Issue | Type | Status |
|-------|------|--------|
| `image_url` not persisted in article_metadata | Systemic — affected all articles processed after the pipeline was built | Fixed (`321b67e`) |
| No lint guardrail for missing image field | Systemic | Fixed (`b3dda74`) |
| 2 articles fetched & updated | Article-specific (source had valid OG image) | Fixed |
| 2 articles remain on `default.png` | Article-specific (source inaccessible/no hero image) | No further action possible automatically |
| 2 editorial articles on `default.png` | Intentional — internal pages | Acceptable |
