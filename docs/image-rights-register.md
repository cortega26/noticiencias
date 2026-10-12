# Registro puntual de derechos de imagen

Fecha: 2026-10-09. Este registro cubre los dos activos MIT sustituidos y consigna riesgos específicos hallados en una revisión acotada de otros artículos. No certifica derechos para el resto del catálogo.

## Activos retirados

- **Artículo del 15-01-2026 sobre el MicroMasters.** El [perfil de MIT News](https://news.mit.edu/2026/how-online-mit-course-supply-chain-management-sparked-new-career-0115) identifica la fotografía con el crédito «Photo: Emma Perakis». Sus [términos de uso](https://news.mit.edu/terms-of-use) ofrecen las imágenes descargables bajo CC BY-NC-ND para uso no comercial. No había autorización comercial separada documentada en este repositorio. Se retiraron el JPEG local y su entrada del manifiesto; ya no quedan derivados de esta fotografía en el repositorio ni en el manifiesto activo. Su eliminación del almacenamiento R2 y del CDN sigue bloqueada por permisos (ver sección de limpieza).
- **Artículo del 07-05-2026 sobre automatización.** El [artículo de MIT News](https://news.mit.edu/2026/study-firms-often-use-automation-control-certain-workers-wages-0507) acredita la imagen «MIT News; iStock». Esa atribución no acredita una licencia comercial de iStock y no se encontró una autorización separada en el repositorio. Se retiraron el JPEG local y su entrada del manifest; no se conserva ningún recorte ni derivado.

## Activos nuevos

### Artículo del 15-01-2026

- **Activo:** `src/assets/images/2026-01-15-micromasters-learning-original.webp`.
- **Autoría y origen:** ilustración vectorial generada con Codex para Noticiencias en esta tarea. Su fuente editable es `docs/image-rights/originals/2026-01-15-micromasters-learning.svg`; no se reutilizó una fotografía, logo, textura ni otro activo de terceros.
- **Uso permitido:** la solicitud del usuario del 09-10-2026 autoriza una alternativa original apta para el uso comercial del sitio. Los [términos de OpenAI](https://openai.com/policies/terms-of-use/) reconocen que, entre OpenAI y el usuario y hasta donde permite la ley, el usuario es propietario del output. No se invoca una licencia de terceros ni se afirma exclusividad o registro de copyright.
- **Exportación:** WebP de 1500 × 1000 px mediante Sharp. SHA-256: `084503a98dab624a254c1c6fee5ba582212da3e27ad9cc0c065feb00ad15849e`; hash del manifest: `084503a98dab624a`.

### Artículo del 07-05-2026

- **Activo:** `src/assets/images/2026-05-07-automation-wages-original.webp`.
- **Autoría y origen:** ilustración vectorial generada con Codex para Noticiencias en esta tarea. Su fuente editable es `docs/image-rights/originals/2026-05-07-automation-wages.svg`; no se reutilizó una fotografía, logo, textura ni otro activo de terceros.
- **Uso permitido:** la solicitud del usuario del 09-10-2026 autoriza una alternativa original apta para el uso comercial del sitio. Los [términos de OpenAI](https://openai.com/policies/terms-of-use/) reconocen que, entre OpenAI y el usuario y hasta donde permite la ley, el usuario es propietario del output. No se invoca una licencia de terceros ni se afirma exclusividad o registro de copyright.
- **Exportación:** WebP de 1500 × 1000 px mediante Sharp. SHA-256: `ea8092d810938de16524c163f4578bf835a756e9114f7b26952fb1f496269f74`; hash del manifest: `ea8092d810938de1`.

## Riesgos concretos en otras imágenes de la muestra

Estos datos describen procedencia y permisos no verificados; no son una conclusión de infracción. La lista exacta de los 18 artículos no está registrada en los PR ni en los documentos activos, así que esta comprobación se limita a los artículos identificables en los PR editoriales #246, #247, #252, #253 y #254.

- **Guardería/microbioma (25-01-2026):** [Scientific American](https://www.scientificamerican.com/article/babies-who-attend-daycare-share-good-germs-too/) acredita la fotografía como StockPlanets/Getty Images. No hay licencia independiente de Noticiencias registrada aquí: `UNVERIFIED`.
- **Cilios de coral (20-09-2026):** [WIRED](https://www.wired.com/story/tiny-hairs-that-help-corals-breathe-may-malfunction-in-warming-oceans/) identifica la imagen como cortesía de Quanta; la [versión de Quanta](https://www.quantamagazine.org/corals-spin-tiny-vortices-to-get-oxygen-but-not-if-its-too-hot-20260805/) acredita la imagen a Cesar Pacharres, coloreada por Quanta. El artículo científico relacionado indica CC BY-NC, pero no se documentó una licencia comercial para la imagen publicada por Quanta: `UNVERIFIED`.
- **Holografía (25-09-2026):** [Quanta Magazine](https://www.quantamagazine.org/gravity-seems-holographic-what-does-that-mean-for-reality-20260925/) acredita la ilustración a Ada Zejun Shen; no hay permiso separado de reutilización en el repositorio: `UNVERIFIED`.
- **Piezo1 (27-01-2026):** [ScienceDaily](https://www.sciencedaily.com/releases/2026/01/260127010149.htm) acredita la imagen como Shutterstock; no hay licencia independiente de Noticiencias registrada aquí: `UNVERIFIED`.
- **Arpones (23-01-2026):** [Live Science](https://www.livescience.com/archaeology/some-of-the-oldest-harpoons-ever-found-reveal-indigenous-people-in-brazil-were-hunting-whales-5-000-years-ago) acredita la fotografía principal al Museu Arqueológico de Sambaquis de Joinville. Esa línea no expresa una licencia para Noticiencias: `UNVERIFIED`. La licencia CC BY-NC-ND de [Nature Communications](https://www.nature.com/articles/s41467-025-67530-w) se refiere a sus imágenes incluidas allí; no se atribuye automáticamente a esta fotografía del museo.

Antes de monetizar cualquiera de esos activos, localizar la licencia comercial aplicable o reemplazar la imagen. La atribución por sí sola no resuelve esos permisos.

Las declaraciones públicas de financiación se actualizaron posteriormente en el PR #256. La activación futura de anuncios debe mantener alineados consentimiento, privacidad y política editorial.

## Limpieza de cuatro derivados CDN: bloqueada por permisos

El usuario autorizó expresamente el 9 de octubre de 2026 eliminar **solo** cuatro objetos R2 de la fotografía MIT del 15 de enero, hash histórico `5121406c65027caa`, anchos 400, 900, 1400 y 1500 px, además de purgar sus cuatro URL exactas. No autorizó borrar otros objetos ni ejecutar purgas amplias.

**Tres ejecuciones verificadas, cero objetos eliminados y ninguna purga realizada:**

- [Run #38018565846](https://github.com/cortega26/noticiencias/actions/runs/38018565846): faltan `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` y `CLOUDFLARE_R2_ENDPOINT` en GitHub Actions. El proceso se detuvo antes de contactar con R2.
- [Run #38018951545](https://github.com/cortega26/noticiencias/actions/runs/38018951545): el token principal de Cloudflare reconoció la zona, pero devolvió **HTTP 403** al consultar el primer objeto R2 mediante `GET`. No se efectuó ningún `DELETE`.
- [Run #38019369852](https://github.com/cortega26/noticiencias/actions/runs/38019369852): se probó de forma acotada `DELETE` sobre el primero de los cuatro objetos, sin lectura previa. La API respondió **HTTP 403**, por lo que no se intentaron los otros tres ni la purga.

La causa comprobada es **falta de permisos de lectura y escritura R2 en el token disponible**, además de ausencia de credenciales S3. Para ejecutar esta operación se necesita autorización de R2 limitada al bucket correspondiente, mediante credenciales S3 de R2 o un token de Cloudflare con `Workers R2 Storage Read` y `Workers R2 Storage Write`. La purga requiere además `Cache Purge` para la zona. No se deben ampliar privilegios de forma automática.

Claves exactas que siguen pendientes de eliminación:

- `posts/2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras.5121406c65027caa.400.avif`
- `posts/2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras.5121406c65027caa.900.avif`
- `posts/2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras.5121406c65027caa.1400.avif`
- `posts/2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras.5121406c65027caa.1500.avif`

Las URL del CDN corresponden exactamente a esas claves bajo `https://www.cdn.noticiencias.com/`. Ya no están referenciadas desde los artículos ni desde el manifiesto activo, pero **no se verificó su retirada del bucket ni su inaccesibilidad pública**. El estado permanece `PARTIAL / BLOCKED_BY_CLOUDFLARE_ACCESS`; no declarar `EDITORIAL PREFLIGHT COMPLETE` por este criterio. El procedimiento temporal se retira del repositorio después de los intentos infructuosos.
