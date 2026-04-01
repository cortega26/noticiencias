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

- **Replace `default.png` with article-specific images** for the 3 articles using the placeholder (articles 1, 2, 4). The `default.png` is a temporary fix; editorial quality improves with topical hero images. The news_collector pipeline should generate these automatically on re-processing.

- **Add `check:hero-images` to `validate:content`** as well. Currently it runs in `lint`; adding it to `validate:content` ensures CI catches it during content validation too.

### Medium priority

- **Fix unused `eslint-disable` directives** in `scripts/check-frontmatter-dates.js` (lines 25, 29, 58). These cause 3 non-blocking ESLint warnings. They can be removed now that the security plugin no longer flags those patterns.

- **Validate `image_alt` presence** in `check-hero-images.js` or the schema. Currently no article uses `image_alt`, but the schema supports it and accessibility audits will benefit from it.

- **Extend the check to public `/images/` paths**: the guardrail skips existence checks for `/images/` paths since those live in `public/` and require a build to verify. A separate dist-sanity step could cover this.

### Low priority

- **Investigate the Codex PR `778cf2c`** (Remove leaked authoring prompt). Since CI is offline, this PR was not merged. The preamble fix has been applied directly to main in this session. Once CI is restored, the PR should be closed as superseded.

- **Add image dimensions to `default.png` fallback** articles. The schema supports `image` as an object `{ src, width, height }`. Using the full object form allows Astro to generate properly sized `<img>` without an extra stat call.

---

## Remaining Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Future articles generated without `image` field | Medium | Guardrail in `npm run lint` now catches this before commit |
| `default.png` used permanently instead of being replaced | Low | Track as content backlog item; visible in frontmatter |
| LLM preamble leak recurs in future articles | Low | Fixed in news_collector `_extract_markdown_content()` in same session |
| Public `/images/` path typos not caught by guardrail | Low | Caught by `npm run test:audit` (vitest site-integrity suite) |
