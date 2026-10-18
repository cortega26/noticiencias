# AdSense: rechazo «Contenido de bajo valor» (18-oct-2026), registro de remediación

**Estado:** en ejecución. Este documento es la bitácora de evidencia: qué se midió, qué se cambió y cuándo. Sirve de changelog al solicitar de nuevo la revisión de AdSense.

**Decisión de solicitud:** una sola re-solicitud, manual y a cargo del titular de la cuenta, cuando se cumpla el checklist de la sección 4. Estimación: 10–12 semanas desde el 18-oct-2026. Ni este documento ni sus cifras garantizan la aprobación.

## 1. Evento

- Solicitud enviada: 9-oct-2026. Resultado: 18-oct-2026, Sitios → «Requiere atención · Contenido de bajo valor». ads.txt «Autorizado». Centro de políticas sin incidencias.
- El mensaje no indica páginas ni causa concreta. Las viñetas oficiales piden: información auténtica y de alta calidad, selección constante de contenido con mantenimiento estructural, e interés genuino y sostenido de los usuarios.

## 2. Línea base (18-oct-2026)

| Medida                                         | Valor                                                                                                                                     | Fuente                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Posts publicados                               | 50 (12 con `schema_version: 1`)                                                                                                           | `src/content/posts/`         |
| Posts con fuente primaria                      | 20 de 50; 6 sin bloque de fuentes                                                                                                         | frontmatter `sources[].role` |
| Autor «Noticiencias AI»                        | 25 de 50                                                                                                                                  | frontmatter `author`         |
| Imágenes con licencia verificada               | 11 originales documentadas; 38 sin revisión individual (inventario del 12-oct)                                                            | `docs/image-rights-*.md`     |
| Héroes con nombre de archivo de la fuente      | ≥20 (título inglés de la nota original)                                                                                                   | `src/assets/images/`         |
| Search Console, 17-jul → 16-oct                | 63 clics, 701 impresiones; 59 clics son de marca («noticiencias», «noticiencia») o de un pico de 2 días («inteligencia artificial»)       | GSC, Rendimiento             |
| GA4, últimos 7 días                            | 3 usuarios activos, 3 sesiones directas                                                                                                   | GA4                          |
| Indexación                                     | 76 indexadas; 320 sin indexar (229 noindex en `/temas/*`, 49 redirecciones, 23 rastreadas sin indexar, 15 × 404, 3 robots, 1 descubierta) | GSC, Páginas                 |
| Artículos «rastreada, actualmente sin indexar» | 2: Meta/YouTube (27-mar) y tortuga (26-ago)                                                                                               | GSC, Páginas                 |
| Acciones manuales                              | Ninguna                                                                                                                                   | GSC                          |
| Publicación por mes (1.er commit)              | ene 9 · feb 9 · mar 4 · abr 2 · may 4 · jun 2 · jul 0 · ago 1 · sep 12 · oct 7                                                            | `git log --diff-filter=A`    |

## 3. Causas, ordenadas por evidencia

Detalle y fuentes en el plan de trabajo. Resumen: **A** patrón de traducción/adaptación de terceros visible en cada página; **B** imágenes tomadas de las fuentes; **C** audiencia casi nula y publicación irregular; **D** relleno heredado y falta de foco; **E** ruido estructural (formulario de boletín roto, 404, fecha del post = fecha de la fuente); **F** textos de confianza desactualizados y autodescalificadores; **G** defectos menores de datos estructurados.

## 4. Checklist para solicitar de nuevo la revisión

1. Ninguna imagen de procedencia no verificada en portada ni en posts vivos.
2. Ningún post de relleno vivo; todos puntúan ≥8 en la rúbrica o fueron reescritos; ≥30 posts vivos.
3. Ocho semanas consecutivas, contadas desde que el pipeline deja de producir posts con imagen ajena y etiqueta inexacta, con ≥2,5 posts/semana de media y sin huecos >5 días.
4. Etiquetas de fuente exactas, autoría humana con página de autor y textos de confianza actualizados.
5. Boletín probado de extremo a extremo, o retirado.
6. 301/404 resueltos y JSON-LD válido en el Rich Results Test (3 artículos).
7. ≥95 % de los posts vivos con más de ~14 días indexados en GSC y sin acciones manuales.
8. Señal de audiencia (blanda): clics no-marca y usuarios recurrentes al alza durante ≥4 semanas.
9. Este changelog completo. La solicitud la pulsa el titular de la cuenta.

## 5. Changelog

| Fecha      | Cambio                                                                      | PR            | Estado     |
| ---------- | --------------------------------------------------------------------------- | ------------- | ---------- |
| 2026-10-18 | Línea base, causas y checklist (este documento) y triage de contenido       | frontend #299 | PR abierto |
| 2026-10-18 | Etiquetas de fuente exactas (fuente primaria vs. cobertura)                 | frontend #300 | PR abierto |
| 2026-10-18 | Textos de confianza sin estado de AdSense obsoleto ni sobreafirmaciones     | frontend #301 | PR abierto |
| 2026-10-18 | Redirecciones para URLs `/article-NNN/` y hubs `/categorias/`, `/recursos/` | frontend #302 | PR abierto |
| 2026-10-18 | JSON-LD con imagen y migas de pan absolutas                                 | frontend #303 | PR abierto |
| 2026-10-18 | Héroes de portada (4) sustituidos por ilustraciones originales              | frontend #304 | PR abierto |
| 2026-10-18 | Héroes de otros 4 posts recientes (apilado sobre #304)                      | frontend #305 | PR abierto |
| 2026-10-18 | El backend deja de reutilizar imágenes de las fuentes (allowlist vacía)     | backend #374  | PR abierto |
| 2026-10-18 | CI del backend: `plans/` en el checkout parcial del frontend                | backend #375  | PR abierto |

El reloj de «8 semanas de constancia» del checklist arranca cuando estén fusionados y desplegados #300, #304/#305 y backend #374.

## 5b. Pendientes que dependen del titular

- Fusionar los PR en este orden: backend #375 → #374; frontend #299, #300, #301, #302, #303, #304 → #305.
- Aprobar la lista de despublicación de `CONTENT_TRIAGE.md`.
- Handle real de Buttondown (o autorizar ocultar los formularios): hoy el perfil público devuelve «Not found».
- Confirmar que los términos vigentes de Anthropic permiten el uso comercial de las ilustraciones generadas.
- Decidir si el aviso «síntesis asistida por IA» se muestra en todos los posts: hoy solo en los 25 con autor «Noticiencias AI»; los 25 antiguos con autor «Noticiencias» no lo llevan.
- `robots.txt`: `facebookexternalhit` es el rastreador de vistas previas, no de entrenamiento (ADR-0008 lo trata como entrenamiento); valorar sustituirlo por `meta-externalagent`.
- GA4: los envíos duplicados a `www.google.com/g/collect` indican señales publicitarias a nivel de propiedad; revisar Admin → Recopilación de datos (Google Signals) y vínculos con Google Ads, porque la política de privacidad dice que están desactivados.
- Opcional: 301 reales con Cloudflare Bulk Redirects (hoy son páginas con meta refresh).

## 6. Medición semanal

Ventanas idénticas y asentadas (GSC) y 7/28 días (GA4). Anotar siempre la fecha de consulta.

| Semana (lunes) | Clics no-marca (28 d) | Usuarios GA4 (7 d) | Posts nuevos | URLs indexadas |
| -------------- | --------------------- | ------------------ | ------------ | -------------- |
| 2026-10-19     | por medir             | por medir          | 0            | 76             |
