# Plantilla de artículo

Guía para redactar un archivo `.md` en `src/content/posts/`. No publicar este
archivo ni sus ejemplos literalmente: reemplazar los textos, fecha, fuentes,
imagen y metadatos con evidencia editorial. La autoridad es
`src/content.config.ts`; consultar `docs/tagging.md` para etiquetas y
`AGENTS.md` para validación. `schema_version: 2` requiere los seis campos
editoriales estructurados que se muestran abajo.

```yaml
---
title: 'Título informativo con el alcance del hallazgo'
schema_version: 2
author: Equipo Noticiencias
date: 2026-09-04
excerpt: 'Resumen específico que explica el hallazgo y su principal limitación.'
categories:
  - Tecnología
tags:
  - inteligencia artificial
image: /assets/images/reemplazar-con-imagen-real.jpg
image_alt: 'Descripción específica de la imagen elegida.'
translation_method: asistida
review_status: en_revision
confidence: media
summary_points:
  - 'Primer resultado respaldado por la fuente.'
  - 'Segundo resultado o limitación relevante.'
glossary:
  - term: 'Término necesario'
    definition: 'Explicación breve y accesible.'
fact_check:
  - label: 'Afirmación concreta que se ha comprobado.'
    status: uncertain
why_it_matters:
  - 'Relevancia sustentada, sin prometer aplicaciones no demostradas.'
sources:
  - title: 'Nombre de la fuente primaria real'
    url: 'https://example.com/reemplazar-con-fuente'
    publisher: 'Institución o revista real'
---
```

## Lo que sabemos

Abrir con el hallazgo, quién lo estudió y en qué contexto. Distinguir observación,
inferencia y aplicaciones posibles. Usar citas textuales solo si se verificaron.

## Evidencia y límites

Explicar población, método y limitaciones con fuentes. Mantener una jerarquía
de encabezados ordenada; el título de página ya aporta el `h1`.

## Por qué importa

Conectar la evidencia con la pregunta del lector, sin exagerar certeza ni alcance.
Antes de publicar, sustituir todos los ejemplos y ejecutar `npm run lint` y
`npm run validate:content`; la validez del YAML no prueba rigor editorial.
