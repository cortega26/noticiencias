# AdSense: rechazo «Contenido de bajo valor» (18-oct-2026), registro de remediación

**Estado al 24-oct-2026:** frontend integrado, desplegado y verificado; preparación editorial aún incompleta. Este documento es la bitácora de evidencia: qué se midió, qué se cambió y cuándo. Sirve de changelog al solicitar de nuevo la revisión de AdSense.

**Decisión de solicitud:** una sola re-solicitud, manual y a cargo del titular de la cuenta, cuando se cumpla el checklist de la sección 4. El periodo acordado es de cuatro semanas estables después de verificar la preparación editorial y la producción; no hay una fecha prometida. Ni este documento ni sus cifras garantizan la aprobación.

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
| GA 4, últimos 7 días                           | 3 usuarios activos, 3 sesiones directas                                                                                                   | GA 4                         |
| Indexación                                     | 76 indexadas; 320 sin indexar (229 noindex en `/temas/*`, 49 redirecciones, 23 rastreadas sin indexar, 15 × 404, 3 robots, 1 descubierta) | GSC, Páginas                 |
| Artículos «rastreada, actualmente sin indexar» | 2: Meta/YouTube (27-mar) y tortuga (26-ago)                                                                                               | GSC, Páginas                 |
| Acciones manuales                              | Ninguna                                                                                                                                   | GSC                          |
| Publicación por mes (1.er commit)              | ene 9 · feb 9 · mar 4 · abr 2 · may 4 · jun 2 · jul 0 · ago 1 · sep 12 · oct 7                                                            | `git log --diff-filter=A`    |

## 3. Diagnóstico actualizado — 22-oct-2026

El rechazo no identifica páginas ni una causa concreta. Riesgos observados: adaptaciones con poco aporte propio; afirmaciones más fuertes que sus fuentes; imágenes con permiso no registrado; promesas de newsletter no verificadas; foco disperso. No se afirma que audiencia baja, antigüedad o asistencia de IA sean por sí mismas motivos de rechazo.

El snapshot del 22-oct recuperó 52 artículos vivos (HTTP 200). La revisión por IA del archivo identificó reparaciones pendientes y no acredita validación factual completa ni revisión humana. Ver `CONTENT_TRIAGE.md`, `archive-snapshot-2026-10-22.json` e `IMAGE_PROVENANCE.md`.

## 4. Gate de preparación y periodo de observación

**RELOJ: NO INICIADO.** La fecha 18-oct de una mejora anterior no inicia retroactivamente el periodo acordado. El despliegue verificado del 24-oct resuelve la integración del frontend, pero no acredita el cierre editorial ni inicia el periodo.

Antes de comenzar las cuatro semanas deben cumplirse y verificarse en producción:

1. Cada artículo vivo reevaluado, con fallos materiales corregidos, consolidación o retiro autorizado donde corresponda. No se compensa un fallo con una puntuación alta.
2. Controles editoriales revisados y aprobación humana del contenido final en operación, con invalidación al cambiar titular, cuerpo o metadatos.
3. Procedencia y pertinencia de imágenes documentadas; ninguna fuente no verificada se da por autorizada.
4. Navegación, metadatos, autoría y promesas del boletín acordes al comportamiento real. No inventar revisores humanos ni ocultar asistencia de IA.
5. Checks de producción de rutas, imágenes, canonicals, accesibilidad y regresiones aprobados.

Después: observar cuatro semanas estables con evidencia semanal. Una recurrencia material pausa la preparación hasta corregirse y verificarse. Tráfico/indexación informan la decisión: no son umbrales de aprobación. No se exigen 30 artículos,8 puntos,2,5 posts/semana,95 % de indexación ni ocho semanas como requisitos de Google.

El titular presenta una sola re-solicitud tras revisar la evaluación final. [Guía oficial de contenido y experiencia de AdSense](https://support.google.com/adsense/answer/10015918?hl=es) y [orientación de Search sobre IA generativa](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content). Ningún gate propio garantiza aprobación.

## 5. Changelog

| Fecha      | Cambio                                                                   | PR            | Estado                 |
| ---------- | ------------------------------------------------------------------------ | ------------- | ---------------------- |
| 2026-10-18 | Línea base, causas y checklist (este documento), triage y comparables    | frontend #299 | Fusionado y desplegado |
| 2026-10-18 | Etiquetas de fuente exactas (fuente primaria vs. cobertura)              | frontend #300 | Fusionado y desplegado |
| 2026-10-18 | Textos de confianza sin estado de AdSense obsoleto ni sobreafirmaciones  | frontend #301 | Fusionado y desplegado |
| 2026-10-18 | Redirecciones para `/article-NNN/` y hubs `/categorias/`, `/recursos/`   | frontend #302 | Fusionado y desplegado |
| 2026-10-18 | JSON-LD con imagen y migas de pan absolutas                              | frontend #303 | Fusionado y desplegado |
| 2026-10-18 | Héroes de portada (4) sustituidos por ilustraciones originales           | frontend #304 | Fusionado y desplegado |
| 2026-10-18 | Héroes de otros 4 posts recientes (#305 se cerró solo al borrar su base) | frontend #306 | Fusionado y desplegado |
| 2026-10-18 | CI del backend: `plans/` en el checkout parcial del frontend             | backend #375  | Fusionado              |
| 2026-10-18 | El backend deja de reutilizar imágenes de las fuentes (allowlist vacía)  | backend #374  | Fusionado              |

Todo lo anterior está en producción desde el 2026-10-18 (despliegue de `7e39fbfa`, verificado con `npm run test:deploy`). Ese hito histórico no acredita el nuevo gate ni inicia el periodo de observación. El comportamiento actual del backend requiere verificación separada.

## 5 b. Registro histórico: cambios preparados el 22-oct-2026

- Ocho reescrituras con fuentes: Shanidar, hongos, esports, GlucoFM, eclipse, optogenética y dos piezas DES. Dos correcciones puntuales de comparaciones falsas (Starship y edad planetaria). Ver `EDITORIAL_EVIDENCE.md`. Fecha original y rutas conservadas; cambios sujetos a aprobación editorial.
- Dos guías: carbono de bosques/suelos y evidencia de exoplanetas, con comparaciones y diagramas originales. Asistencia de IA declarada, sin acreditar revisión externa.
- Triage vivo 52/52 URLs; soporte factual completo y procedencia de 32 imágenes aún pendientes. GET/fuentes y conteos no son aprobación.
- Plan operativo de 4–8 h/semana, paquetes de distribución y borradores de contacto, sin envíos.
- Newsletter: retirada de CTA en Bienvenidos preparada; retirada completa y verificación pública depende de la rama de experiencia y su despliegue autorizado.

**Estado al 22-oct:** cambios preparados para revisión en ramas aisladas; entonces sin despliegue y con autorización de merge pendiente. Los checks técnicos locales no probaban aceptación editorial ni comportamiento público. El estado de integración posterior consta en la sección 5 c; las evidencias y snapshots del 22-oct conservan su alcance histórico.

## 5 c. Integración y verificación del 24-oct-2026

El titular autorizó commit, merge y publicación el 24-oct. Esta autorización no acredita una revisión humana factual o semántica de cada artículo ni permite atribuirla a una persona.

- Frontend: [PR #345](https://github.com/cortega26/noticiencias/pull/345), merge `1410e266bf61f91a0eff847b30ad6bc9a99828c3`, y [PR #346](https://github.com/cortega26/noticiencias/pull/346), merge `4224860a3fb254801333b010f2c2cf9a3450237c`. Incluyen las correcciones editoriales, las dos guías y la experiencia pública preparada. [GitHub Pages](https://github.com/cortega26/noticiencias/actions/runs/40102707690), [Content Guard](https://github.com/cortega26/noticiencias/actions/runs/40102707711) y [Hero](https://github.com/cortega26/noticiencias/actions/runs/40102707850) finalizaron correctamente para ese SHA.
- Producción: `npm run test:deploy -- https://noticiencias.com` pasó en modo estricto el 24-oct. Se comprobaron los titulares, extractos y resúmenes visibles de los 52 artículos; 70 rutas con canonicals/metadatos válidos, 106 URLs de imágenes/diagramas decodificadas y RSS con 52 entradas. Los formularios y promesas de suscripción están retirados en las superficies comprobadas; privacidad conserva la incertidumbre sobre los datos históricos.
- Navegador: 44 vistas de 11 rutas a 375/1280 px, en claro y oscuro; cero errores de consola, página, red, HTTP, imágenes, desbordamiento o metadatos, sin suprimir telemetría. Se verificaron enlace de salto, menú móvil y fuentes con teclado, y acceso al RSS/archivo sin JavaScript.
- Backend: [PR #388](https://github.com/cortega26/noticiencias_news_collector/pull/388) fusionado como `704f0e227b8f8b86e990c3b0b0b912838a5c48bc`. Su [CI inicial de main](https://github.com/cortega26/noticiencias_news_collector/actions/runs/40102228536) falló únicamente por la auditoría de `happy-dom` del admin. La [PR #389](https://github.com/cortega26/noticiencias_news_collector/pull/389), fusionada como `9ab32a1cdec5538356cbc009a46cf5721579affb`, corrigió esa dependencia a `21.0.4`: [CI del PR](https://github.com/cortega26/noticiencias_news_collector/actions/runs/40117675923) y [Code Quality del PR](https://github.com/cortega26/noticiencias_news_collector/actions/runs/40117675929) aprobados; auditoría del admin sin vulnerabilidades altas ni críticas, 96 tests del admin y 4476 unitarios aprobados (3 omitidos, 190 no seleccionados). Esta evidencia de integración y CI del PR no acredita aceptación operativa del pipeline ni una ejecución real del proveedor.

## 5 d. Decisiones y trabajo aún abierto

- **Paso acotado preparado el 24-oct:** se sustituyó en una rama aislada la portada de Shanidar por una ilustración conceptual original, con PNG nativo, WebP y [recibo de generación](../../image-rights/2026-10-24-shanidar-image-generation.json). La aprobación visual del titular y el despliegue están pendientes. El recuento de procedencia baja de 32 a 31 pendientes en esa propuesta; producción conserva 32 hasta verificar la publicación. No se modificó el contenido factual del artículo ni el resto del archivo.

- El archivo sigue triado 52/52, sin rehabilitación factual completa ni revisión humana factual/semántica acreditada. Realizar y registrar esa revisión del contenido final; la autorización de integración del 24-oct no la sustituye. Cualquier lista concreta de retiros requiere autorización del titular.
- Cerrar errores materiales y la procedencia o sustitución de las 32 imágenes pendientes; no solicitar revisión mientras existan.
- Completar la comparación vieja/nueva de la cadena editorial con un candidato real revisado y aceptación humana semántica. No se ha acreditado una ejecución satisfactoria de ese candidato; el plan 191 del backend permanece **PARCIAL**.
- **RELOJ: NO INICIADO.** El frontend público pasó la comprobación técnica; faltan los cierres editoriales y operativos del gate antes de comenzar las cuatro semanas.
- No se ejecutaron retiros, nuevos redirects, contactos externos ni re-solicitud de AdSense. La configuración de Google Signals/Google Ads conserva su límite de consentimiento; no se cambió en esta tarea.

## 6. Medición semanal

Usar `GROWTH_OPERATIONS.md`: ventanas iguales y asentadas, conteos absolutos, límites de consentimiento y desconocidos explícitos. El snapshot de GSC 22 clics/169 impresiones del 22-sep al 19-oct es contexto aportado por la investigación previa del plan; no se verificó de nuevo en esta rama y no sustituye una exportación actual.
