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

- **Source article-specific images for 2 remaining `default.png` articles**:
  - `2024-07-07-la-paradoja...` (Lilian Weng hallucination post) — needs manually sourced image; blog has no OG tag
  - `2026-02-15-publicidad...` (TechXplore chatbot advertising post) — source returns 403; find equivalent image elsewhere or create one
  - Both are substantive articles and deserve proper hero images

### Medium priority

- **Investigate 6 mislabeled `.jpg` files that are actually WebP**:
  - `2026-01-25-article-86.jpg`, `2026-01-25-article-87.jpg`, `2026-01-27-article-432.jpg`, `2026-01-28-article-343.jpg` are WebP content with `.jpg` extension
  - These still work (Astro reads the file, sharp handles WebP input) but the naming is misleading
  - Low risk — fix at next opportunity by renaming and updating frontmatter

- **AVIF `<picture>` fallback for maximum compatibility** (optional):
  - Currently: AVIF `srcset` + original `src`. Covers ~96% of users.
  - Enhancement: refactor `Image.astro` to emit `<picture><source type="image/avif" srcset="..."><img src="...webp"></picture>` — catches the remaining 4% more gracefully
  - Requires changing the component from `<img>` to `<picture>`, adds complexity

- **Validate `image_alt` presence in guardrail**:
  - `check-hero-images.js` currently only checks `image` field presence and file existence
  - Adding `image_alt` validation would improve accessibility audit compliance

### Low priority

- **Add `check:hero-images` coverage for `/images/` public paths**:
  - Currently only local `~/assets/images/` paths are validated for file existence
  - Public `/images/` paths require a built `dist/` to validate; already covered by `test:audit`

- **Replace `default.png` for editorial articles** (`bienvenidos`, `salud-bienvenida`) with branded editorial placeholders — purely cosmetic

---

## Risks

| Risk                                                                        | Likelihood                                     | Mitigation                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Old articles in DB without `image_url` in metadata — refinery won't find it | High (all articles collected before `321b67e`) | Re-process through refinery, or use export JSON to manually patch        |
| TechXplore / Lilian Weng articles remain on `default.png`                   | Accepted                                       | Documented above; manual intervention needed                             |
| AVIF generation adds ~30s to clean builds (316 variants)                    | Accepted                                       | Cached on subsequent builds; trade-off for ~40–80% page weight reduction |
