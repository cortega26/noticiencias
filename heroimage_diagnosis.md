# Hero Image Diagnosis

## Affected Articles

Four articles were found with hero image issues (three missing images + one bonus preamble leak):

| # | File | Issue | Status |
|---|------|-------|--------|
| 1 | `src/content/posts/2024-07-07-la-paradoja-inesperada-actualizar-una-ia-con-nuevos-datos-puede-intensificar-sus-alucinaciones.md` | `image` field missing entirely | Fixed |
| 2 | `src/content/posts/2026-02-15-publicidad-llega-a-chatbots-de-ia-el-nuevo-modelo-de-negocio-digital-y-sus-dilemas.md` | `image` field missing entirely | Fixed |
| 3 | `src/content/posts/2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.md` | `image` field present but points to non-existent filename | Fixed |
| 4 | `src/content/posts/2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md` | `image` field missing + leaked LLM preamble in body | Fixed |

> Note: the task described "two remaining affected articles"; investigation found four. Article 3 had an `image` field but the referenced file did not exist. Article 4 was caught by the new guardrail script and also had the leaked preamble that was separately flagged by the Codex bot (whose PR was blocked by CI being offline).

---

## How the Issue Was Reproduced

The hero image rendering path in `src/layouts/PostLayout.astro`:

1. Extracts `image` from post frontmatter
2. Converts to string: `imageSrc = typeof rawImage === 'string' ? rawImage : rawImage?.src`
3. Conditionally renders: `{imageSrc && (<div>...</div>)}`

When `image` is missing or points to a non-existent file, `imageSrc` is falsy and the entire hero image `<div>` is silently skipped. No error, no fallback — the article just renders without a featured image.

For article 3, the `findImage()` utility in `src/utils/images.ts` uses `import.meta.glob` to discover assets. If the path doesn't match any file in the glob, it returns `undefined`, triggering the same silent skip.

---

## Confirmed Root Cause

**Primary cause**: The content collection schema marks `image` as `.optional()` (line 24 of `src/content/config.ts`), so Astro does not emit a build error when the field is absent. Articles can be published without hero images and no tooling catches it.

**Secondary cause for article 3**: The article was committed with a verbose filename (`2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.jpg`) that was never the actual asset filename. The real asset is `2026-02-16-677.jpg`.

**Secondary cause for article 4**: The LLM generation pipeline emitted a meta-instruction preamble ("Aquí tienes el artículo, redactado con el enfoque de Editor Científico Senior en Noticiencias:") directly into the article body. This was a separate pre-existing issue now also fixed in the news_collector enrichment pipeline.

---

## Was the General Issue Already Fixed?

**No.** There was no prior fix attempt. The `image` field is optional in the schema and nothing enforced its presence. Most articles have correct images not because they were fixed, but because they were authored correctly the first time. The four broken articles are individual omissions spread across different dates — not the remnants of an incomplete migration.

The actual systemic problem — the absence of a guardrail — was never addressed until this session. `check-hero-images.js` is the first mechanism that would have caught these before publishing.

---

## Evidence

```
# Before fix — three articles with no image field:
$ grep -rL "^image:" src/content/posts/*.md
2024-07-07-la-paradoja-inesperada...md
2026-02-15-publicidad-llega-a-chatbots...md
2026-03-27-el-error-de-redondeo...md

# Article 3 — image field present but file missing:
$ cat 2026-02-16-un-agujero-negro...md | grep "^image"
image: "~/assets/images/2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.jpg"

$ ls src/assets/images/ | grep "2026-02-16"
2026-02-16-677.jpg    # ← actual file; verbose name does not exist

# After fix — all 26 files pass:
$ node scripts/check-hero-images.js
Hero image check passed for 26 files.
```
