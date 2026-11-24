# Article Images Backlog

## Completed

- [x] Fix `image_url` not persisted in `article_metadata` (news_collector `321b67e`)
- [x] Add lint guardrail `check-hero-images.js` for missing/broken image fields (`b3dda74`)
- [x] Fetch and save OG image for `2026-03-27-el-error-de-redondeo` (theconversation.com)
- [x] Fetch and save OG image for `2026-03-26-como-los-llm` (AWS CloudFront)
- [x] Update article frontmatter for both articles
- [x] Enable AVIF as default output format in `astroAssetsOptimizer`
- [x] Wire `config.defaultFormat` into the optimizer (was declared but never consumed)
- [x] Add `.avif` / `.AVIF` to `fetchLocalImages` glob
- [x] Replace URL heuristic with Content-Type–based extension detection in `_download_image`

---

## Remaining — Optional Improvements

### High priority

- **N/A** — All high-priority items resolved. The 2 `default.png` articles (Lilian Weng, TechXplore) now have proper images. Only `2026-02-12-bienvenidos.md` uses `default.png` as an allowlisted editorial placeholder.

### Medium priority

- **AVIF `<picture>` fallback for maximum compatibility** ✅ (implemented June 2026):
  - `src/components/common/Image.astro` now emits `<picture><source type="image/avif" srcset="..."><img src="..."></picture>`

- **Validate `image_alt` presence in guardrail** ✅ (implemented):
  - `check-hero-images.js` + `check-image-alt.js` validate `image_alt` presence and quality
  - 0 posts missing `image_alt`

- **6 mislabeled `.jpg` files that were WebP** ✅ (resolved):
  - `check-image-file-extensions.js` validates magic bytes against extension; currently passes clean

### Low priority

- **Add `check:hero-images` coverage for `/images/` public paths**:
  - Currently only local `~/assets/images/` paths are validated for file existence
  - Public `/images/` paths require a built `dist/` to validate; already covered by `test:audit`

- **Replace `default.png` for editorial articles** (`bienvenidos`) with branded editorial placeholder — purely cosmetic, allowlisted

---

## Risks

| Risk                                                                        | Likelihood                                     | Mitigation                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Old articles in DB without `image_url` in metadata — refinery won't find it | High (all articles collected before `321b67e`) | Re-process through refinery, or use export JSON to manually patch        |
| TechXplore / Lilian Weng articles remain on `default.png`                   | Accepted                                       | Documented above; manual intervention needed                             |
| AVIF generation adds ~30s to clean builds (316 variants)                    | Accepted                                       | Cached on subsequent builds; trade-off for ~40–80% page weight reduction |
