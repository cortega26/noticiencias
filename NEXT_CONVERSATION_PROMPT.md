# Handoff Prompt — Article Images & AVIF Pipeline

## Project context
Noticiencias is a Spanish-language science article site built with Astro. Articles are generated from English sources by a separate news_collector pipeline (`noticiencias_news_collector/`). The site repo is `noticiencias/`.

---

## What was done

### Root cause fixed
`news_collector/collectors/rss_collector.py` line ~928 was missing `"image_url": raw_article.get("image_url")` in the `article_metadata` dict. The image extractor, downloader, and frontmatter writer were all correctly implemented — but the URL was silently dropped before reaching the database. Committed as `321b67e`.

### Articles fixed
Two articles fetched real images from their source and updated:
- `src/content/posts/2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md` → `~/assets/images/2026-03-27-el-error-de-redondeo.jpg` (from theconversation.com OG)
- `src/content/posts/2026-03-26-como-los-llm-aprenden-a-dominar-tus-documentos-la-clave-esta-en-el-finetuning-con-datos-no-estructurados.md` → `~/assets/images/2026-03-26-como-los-llm.png` (from AWS CloudFront OG)

Two articles remain on `default.png` — sources were inaccessible (403 / no OG image):
- `2024-07-07-la-paradoja...` — Lilian Weng blog, no OG tag
- `2026-02-15-publicidad...` — TechXplore, HTTP 403

### AVIF pipeline enabled
**Site repo (`images-optimization.ts`)**:
- `config.defaultFormat` changed from `'webp'` (unused/implicit) to `'avif'`
- `astroAssetsOptimizer` now defaults `format = config.defaultFormat` instead of `undefined`
- Result: `<img srcset="...avif 640w, ..." src="...original.jpg">` — AVIF srcset, original as fallback
- 207 AVIF files generated per build (vs 316 WebP previously); ~40–99% smaller per variant

**Site repo (`images.ts`)**:
- Added `avif,AVIF` to `fetchLocalImages` glob

**News collector (`refinery_engine.py`)**:
- `_download_image()` now uses `Content-Type` header for extension resolution, with URL heuristic as fallback
- Supports `.avif` in the extension map

---

## Exact files changed

### `noticiencias/` (site repo)
- `src/assets/images/2026-03-27-el-error-de-redondeo.jpg` — new asset
- `src/assets/images/2026-03-26-como-los-llm.png` — new asset
- `src/content/posts/2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md` — updated image field
- `src/content/posts/2026-03-26-como-los-llm-aprenden-a-dominar-tus-documentos-la-clave-esta-en-el-finetuning-con-datos-no-estructurados.md` — updated image field
- `src/utils/images-optimization.ts` — AVIF default, `config.defaultFormat` wired in
- `src/utils/images.ts` — avif added to glob

### `noticiencias_news_collector/`
- `news_collector/collectors/rss_collector.py` — `image_url` now persisted (`321b67e`)
- `news_collector/logic/workflows/refinery_engine.py` — Content-Type extension detection

---

## Verification completed
```
npm run lint          → 27 files, 0 errors, 0 warnings ✓
npm run build         → 139 pages, 207 AVIF generated, 0 errors ✓
srcset in HTML        → *.avif at 640w–6016w, src="*.jpg" fallback ✓
```

---

## Recommended next task

**Source article-specific images for the 2 remaining `default.png` articles:**

1. `2024-07-07-la-paradoja-inesperada...` (hallucinations in LLMs, Lilian Weng source)
   - Lilian Weng's blog has no hero image; find a thematically appropriate image
   - Topic: AI hallucination, LLM fine-tuning, knowledge update paradox
   - Suggestion: search for CC-licensed or royalty-free image; save as `src/assets/images/2024-07-07-la-paradoja.{ext}`

2. `2026-02-15-publicidad-llega-a-chatbots...` (advertising in AI chatbots, TechXplore source)
   - TechXplore returns 403; try an alternative source or find equivalent image
   - Topic: AI chatbot advertising, ChatGPT monetization, digital privacy
   - Suggestion: search for CC-licensed image; save as `src/assets/images/2026-02-15-publicidad.{ext}`

After adding images, update frontmatter and verify with `npm run lint`.

---

## Remaining backlog
See `article_images_backlog.md` for full list. Key items:
- [ ] Source images for 2 `default.png` articles above
- [ ] Rename 6 mislabeled `.jpg` files that contain WebP data
- [ ] Consider `<picture>` element for explicit AVIF+WebP fallback chain
- [ ] Re-process old DB articles through refinery to get proper images (they were all collected before `321b67e`)
