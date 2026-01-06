---
title: "Architecture"
---

# Noticiencias Architecture

## Objetivo
Convertir Noticiencias en un medio de ciencia con rigor editorial, trazabilidad y experiencia de lectura profesional.

## Estructura principal
- `_layouts/`: `single.html` para articulos y `splash.html` para portada.
- `_includes/`: componentes editoriales (`post-trust.html`, `post-sources.html`, `reading-progress.html`).
- `_data/`: perfiles de autor y navegacion.
- `_sass/`: overrides visuales y componentes.
- `tools/`: validadores de front matter y JSON-LD.

## Modelo editorial (front matter)
Campos requeridos en posts:
- `title`, `author`, `date`, `excerpt`
- `categories`, `tags`
- `image`, `image_alt`
- `translation_method` (humana | asistida | mixta)
- `editorial_score` (0-100)
- `review_status` (verificado | en_revision | actualizando)
- `confidence` (alta | media | baja)
- `sources` (lista con `title`, `url`, `publisher`, `date`, `doi`)
Opcionales: `featured`, `investigation`, `fact_check`, `why_it_matters`.

## Experiencia editorial
- Barra de progreso de lectura en articulos.
- Ficha editorial con indicadores de verificacion.
- Bloque "Por que importa".
- Lista de fuentes y referencias al final.

## SEO y rendimiento
- `jekyll-seo-tag` y `jekyll-sitemap` activos.
- JSON-LD `NewsArticle` por articulo.
- Imagenes con `loading="lazy"` y `decoding="async"`.
- CSS critico inlined en `head.html`.

## CI/CD y calidad
En GitHub Actions:
- `tools/validate_frontmatter.py`: esquema editorial.
- `tools/validate_jsonld.py`: JSON-LD NewsArticle.
- `htmlproofer`: links rotos internos.
- Lighthouse CI: umbral >=95 en performance, accessibility, SEO.
