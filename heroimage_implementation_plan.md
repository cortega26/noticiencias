# Hero Image Implementation Plan

## Implementation Steps

### Step 1 — Content data fixes (4 articles)

**Articles 1 & 2 & 4** (missing `image` field):
Added `image: "~/assets/images/default.png"` after the `excerpt` field.

- `src/content/posts/2024-07-07-la-paradoja-inesperada-actualizar-una-ia-con-nuevos-datos-puede-intensificar-sus-alucinaciones.md`
- `src/content/posts/2026-02-15-publicidad-llega-a-chatbots-de-ia-el-nuevo-modelo-de-negocio-digital-y-sus-dilemas.md`
- `src/content/posts/2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md`

**Article 3** (wrong image filename):
Changed the `image` path from the non-existent verbose filename to the actual asset on disk:

```diff
- image: "~/assets/images/2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.jpg"
+ image: "~/assets/images/2026-02-16-677.jpg"
```

- `src/content/posts/2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.md`

**Article 4 bonus** (leaked LLM preamble in body):
Removed the leaked meta-instruction text and the stray `---` separator that followed it:

```diff
- Aquí tienes el artículo, redactado con el enfoque de Editor Científico Senior en Noticiencias:
-
- ---
-
  ## El Verdadero Terremoto Legal
```

### Step 2 — Guardrail script

Created `scripts/check-hero-images.js` — mirrors the structure of the existing `check-frontmatter-dates.js` for consistency.

**What it checks:**

1. Every article has a non-empty `image` field in frontmatter
2. For `~/assets/images/` paths, the referenced file actually exists in `src/assets/images/`
3. Public `/images/` paths and remote URLs are accepted as-is (file existence for public/ is deferred to build-time)
4. Path traversal in the extracted filename is rejected

**What it does NOT check** (out of scope / handled elsewhere):

- Whether the image dimensions are appropriate
- Whether the image has alt text (tracked as low-priority follow-up)
- Public `/images/` path existence (requires a built `dist/`, handled by `test:audit`)

### Step 3 — Package.json wiring

Added the new check script and included it in the `lint` chain:

```diff
+   "check:hero-images": "node scripts/check-hero-images.js",
-   "lint": "npm run check:frontmatter-dates && eslint .",
+   "lint": "npm run check:frontmatter-dates && npm run check:hero-images && eslint .",
```

---

## Justification for Default Image

`~/assets/images/default.png` is used for the three articles lacking a specific image because:

- No thematically appropriate image exists in `src/assets/images/` for these articles
- The image is already present in the asset pipeline
- It renders a visible hero image, which is better than a blank section
- Using `default.png` is a clear signal in the content data that the article needs a dedicated image

---

## Verification

```
$ node scripts/check-hero-images.js
Hero image check passed for 26 files.

$ node scripts/check-frontmatter-dates.js
Frontmatter date check passed for 26 files.

$ npm run lint
# ✓ check:frontmatter-dates — 26 files
# ✓ check:hero-images — 26 files
# ✓ eslint — 3 warnings (pre-existing, non-blocking)
```

All 26 articles pass. No previously passing article was broken.
