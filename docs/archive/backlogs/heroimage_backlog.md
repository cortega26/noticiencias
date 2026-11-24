# Hero Image Backlog

## Completed

- [x] Fix articles 1 & 2 & 4: add missing `image` field (uses `default.png` placeholder)
- [x] Fix article 3: correct image path to actual asset filename on disk
- [x] Fix article 4: remove leaked LLM preamble from article body
- [x] Create `scripts/check-hero-images.js` guardrail
- [x] Wire guardrail into `npm run lint`

---

## Optional Follow-up Improvements

### High priority

- **Replace `default.png` with article-specific images** ✅ (resolved June 2026): The 3 articles now have proper images. Only `2026-02-12-bienvenidos.md` (editorial welcome post) uses `default.png` via allowlist.

- **Add `check:hero-images` to `validate:content`** ✅ (resolved): Already integrated in both `lint` and `validate:content`.

### Medium priority

- **Fix unused `eslint-disable` directives** in `scripts/check-frontmatter-dates.js` (lines 25, 29, 58). These cause 3 non-blocking ESLint warnings.

- **Validate `image_alt` presence** ✅ (resolved June 2026): `check-hero-images.js` + `check-image-alt.js` validate `image_alt`. All 30 posts have `image_alt`.

- **Extend the check to public `/images/` paths**: the guardrail skips existence checks for `/images/` paths since those live in `public/` and require a build to verify. Already covered by `test:audit`.

### Low priority

- **Investigate the Codex PR `778cf2c`** (Remove leaked authoring prompt). Superseded by direct main commit. Close PR when CI is restored.

- **Add image dimensions to `default.png` fallback** articles. The schema supports `image` as an object `{ src, width, height }`. Only `bienvenidos.md` remains.

---

## Remaining Risks

| Risk                                                     | Likelihood | Mitigation                                                            |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| Future articles generated without `image` field          | Medium     | Guardrail in `npm run lint` now catches this before commit            |
| `default.png` used permanently instead of being replaced | Low        | Track as content backlog item; visible in frontmatter                 |
| LLM preamble leak recurs in future articles              | Low        | Fixed in news_collector `_extract_markdown_content()` in same session |
| Public `/images/` path typos not caught by guardrail     | Low        | Caught by `npm run test:audit` (vitest site-integrity suite)          |
