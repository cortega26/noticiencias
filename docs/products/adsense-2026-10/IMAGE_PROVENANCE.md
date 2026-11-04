# Procedencia de imágenes revisada — 22 de octubre de 2026

No se certifican licencias por el nombre del archivo. El snapshot del archivo contiene el SHA-256 actual de las 52 imágenes usadas en producción y las rutas del origen local. 19 hashes coinciden exactamente con el registro de derechos o la renovación del 19-oct. El inventario histórico y las fuentes SVG antiguas no prueban que todos los bytes actuales sean esos originales.

## Hongos 3822

- Activo: `src/assets/images/2026-10-15-los-hongos-bajo-tus-pies-absorben-13-000-millones-de-toneladas-de-co2-anuales.png`.
- Original conservado: `/tmp/noticiencias-editorial-images-20261021/output/imagegen/3822-fungi.png`.
- SHA-256 de ambos archivos comprobado el 22-oct: `f1c6713543cdd18c5d8ecfb72a7a7661aff9101fae75f2000b07c92be9091bae`.
- Coincidencia byte a byte: no hubo transformación entre estos dos PNG. El registro de la sesión original identifica generación con IA; la coincidencia verifica identidad del archivo, no derechos exclusivos ni revisión científica del dibujo. No es una fotografía ni una medida del flujo de carbono.
- [Recibo de generación duradero en el backend](https://github.com/cortega26/noticiencias_news_collector/blob/1b948aedf67c105fd3309b7da068cb2ea6c62a1b/plans/190/tests/3822-image-generation.json): registra `OpenAI imagegen (Codex built-in)`, dimensiones `1672 × 941`, el mismo SHA-256 y el commit del activo `fa663c7293d5afdcbff24cc0e7283a4d1707c4de`. La comprobación actual del PNG coincide con ese recibo.
- Falta verificar la presentación pública antes de cerrar aprobación editorial de la imagen.

## Diagramas de las guías nuevas

`public/assets/diagrams/carbono-flujo-deposito.svg` y `public/assets/diagrams/exoplanetas-evidencia.svg` se escribieron como SVG originales en esta tarea. Sin fotografías, texturas, logos ni trazados copiados. Incluyen título/descripción accesibles, etiquetas en español y una leyenda que aclara su alcance cualitativo. La primera guía cita Hawkins 2023 e IPCC; la segunda NASA, Catling y Meadows. Son diagramas explicativos, no resultados originales ni reconstrucciones de observaciones.

Los SVG se sirven íntegros porque el contenido vectorial y sus etiquetas no necesitan derivados raster. No se sustituyeron las portadas profesionales existentes.

## Shanidar A: un reemplazo preparado el 24-oct-2026

Se preparó una ilustración conceptual nueva de una escápula genérica sobre papel de estudio, junto a una lupa. No muestra un arma, una perforación ni una reconstrucción del ataque o del fósil de Shanidar A. El crédito y el texto alternativo del artículo lo aclaran.

El [recibo de generación](../../image-rights/2026-10-24-shanidar-image-generation.json) conserva el prompt y vincula los bytes devueltos por `image_gen` con el PNG nativo incluido en el repositorio y su exportación WebP. La identidad de los archivos se comprueba por SHA-256; no se presenta como una certificación de derechos exclusivos o de revisión científica.

- Original: `docs/image-rights/originals/2026-10-24-shanidar-scapula-study.png`.
- Activo propuesto: `src/assets/images/2026-10-17-shanidar-scapula-study-original.webp`, SHA-256 `483809951141cd6521d35f09cd360453b5a73271e235629a881830959572f500`.
- **Estado: revisión visual y publicación pendientes.** En esta rama hay un reemplazo documentado más: 21 de las 52 portadas tienen procedencia trazada y quedan 31 pendientes. El recuento de producción sigue siendo 32 pendientes hasta aprobar, desplegar y comprobar este reemplazo.

El snapshot del 22-oct y el triage de las imágenes observadas entonces permanecen históricos; no se reescriben sus rutas o hashes para aparentar que el reemplazo ya estaba publicado.

## Pendientes

En la referencia de producción siguen pendientes 32 activos sin hash vinculado a una autorización en los registros inspeccionados; la propuesta de Shanidar reduce ese conjunto a 31 solo en esta rama. El snapshot identifica exactamente artículo/ruta/hash. La falta de registro no demuestra infracción, pero impide declarar resuelta la procedencia. Revisar recibos backend, autor, licencia y condiciones de cada imagen; aprobar alternativas específicas cuando no pueda cerrarse el permiso. La revisión visual de relevancia de todo el archivo está pendiente: ni disponer de alt ni de un archivo propio demuestra que una imagen no induzca a error.

## Evidencia local adicional — 31 de octubre de 2026

La portada de interferometría cuántica se sustituyó por una [ilustración conceptual con recibo](../../image-rights/2026-10-31-quantum-interferometry.json). La portada de Artemis II se sustituyó por una fotografía documental de NASA, la de Teghaza 001 por una imagen microscópica de NASA/JPL y la guía del eclipse de 2027 por una fotografía de archivo de NASA tomada en 2024; además se documentó el crédito de la fotografía de lanzamiento en la nota de comunicación láser. La figura de GlucoFM, cuya autorización de reutilización no se había acreditado, se reemplazó por una [ilustración conceptual con recibo](../../image-rights/2026-10-31-glucofm-concept.json), etiquetada como generada con IA y no representativa de datos reales. Las fuentes, hashes, condiciones y límites están en el [registro de derechos](../../image-rights-register.md). Estos cambios son locales, no alteran el snapshot histórico de producción y no prueban que el resto del archivo tenga procedencia resuelta. La portada de la nota sobre lesiones por rayos también se sustituyó localmente por una fotografía de archivo de NASA/Nichole Ayers, con fuente y hash en el registro. Ocho ilustraciones del lote de octubre ahora declaran generación con IA en su leyenda.

La portada del censo oceánico se sustituyó localmente por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-ocean-census-concept.json), expresamente identificada como un organismo imaginario y no una observación científica. El cambio no cierra la procedencia del resto del archivo ni implica revisión visual del titular.

La portada de la nota sobre pan y harina de girasol se sustituyó localmente por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-sunflower-bread-concept.json), sin presentarla como fotografía de los panes del estudio. Falta aprobación visual del titular y verificación después del despliegue.

La portada de la nota sobre riesgo de cáncer se sustituyó localmente por una [ilustración abstracta generada con IA](../../image-rights/2026-10-31-cancer-risk-concept.json), identificada como no cuantitativa y no microscópica. Falta aprobación visual del titular y verificación después del despliegue.

La portada de la nota sobre sarampión se sustituyó localmente por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-measles-vaccination-concept.json), sin identificarla como un producto o campaña real. Falta aprobación visual del titular y verificación después del despliegue.

## Inventario mecánico local actualizado — 31 de octubre

Para los 60 artículos locales (incluidos los 52 del snapshot histórico), se calcularon los hashes de las portadas que apuntan los frontmatter y se buscaron en los registros indicados en [imagen-hash-local-2026-10-31.json](imagen-hash-local-2026-10-31.json). Tras los reemplazos locales del 1 de noviembre: **60 hashes encontrados y ningún archivo ausente**. El corte no prueba el estado público. Una coincidencia no valida automáticamente permisos, licencia ni relevancia visual; una ausencia en los registros consultados tampoco demuestra infracción. Cada resultado conserva ruta y hash para revisión individual.

Las portadas de las notas sobre OpenClaw, Claude Code y Muse Glimmer se sustituyeron localmente por ilustraciones conceptuales generadas con IA y etiquetadas en sus pies como escenas imaginarias, no interfaces o hardware de los productos. Los recibos [OpenClaw](../../image-rights/2026-11-01-personal-assistant-concept.json), [Claude Code](../../image-rights/2026-11-01-coding-assistant-concept.json) y [Muse Glimmer](../../image-rights/2026-11-01-multimodal-chip-concept.json) vinculan originales y derivados. La falta de coincidencia de los archivos anteriores en los registros consultados no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

Para la nota sobre ANAIS y COSINE no se incorporó la fotografía [TESSERACT](<https://commons.wikimedia.org/wiki/File:Basic_Science_(54395491980).jpg>): figura en Commons como obra federal, pero sus metadatos identifican copyright de la Universidad de California. En cambio, el [esquema ANAIS](https://commons.wikimedia.org/wiki/File:Artistic_view_of_the_ANAIS-112_set_up.jpg) de la portada local figura como CC BY-SA 4.0 y coincide con el original del proyecto; una versión del mismo esquema aparece también en una publicación de los investigadores bajo CC BY 4.0. La identidad del usuario que añadió la licencia en Commons no se ha verificado independientemente. Véase el [registro](../../image-rights-register.md).

La nota sobre agrupamiento de galaxias usa localmente una [imagen de archivo del campo ultraprofundo de Hubble](../../image-rights-register.md), con crédito NASA/ESA y aclaración de que no son datos de DES. La imagen anterior no tenía coincidencia exacta en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La nota sobre plataformas HAPS utiliza localmente una [ilustración conceptual de un dirigible](../../image-rights/2026-11-01-haps-airship-concept.json), identificada como generada con IA y no representativa de un vehículo o vuelo real. Sustituye una imagen sin coincidencia en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La nota sobre Project Silica utiliza localmente una [ilustración conceptual de una placa de vidrio](../../image-rights/2026-11-01-glass-storage-concept.json), etiquetada como generada con IA y no representativa del dispositivo. Sustituye una imagen sin coincidencia en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La nota sobre ADN de tortugas utiliza localmente una [fotografía CC0 de Wikimedia Commons](../../image-rights-register.md), con crédito y aclaración de que no se documentó relación con las muestras del estudio. La portada anterior carecía de coincidencia de hash en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La nota sobre relatos de modelos de lenguaje utiliza localmente una [ilustración de un faro imaginario generada con IA](../../image-rights/2026-11-01-lighthouse-fiction-concept.json). Sustituye una fotografía cuya procedencia no se identificó en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La nota sobre electridos utiliza localmente una [ilustración abstracta generada con IA](../../image-rights/2026-11-01-electride-concept.json), identificada como metáfora y no como estructura o muestra real. Sustituye una imagen cuya procedencia no se identificó en los registros consultados; esto no demuestra ausencia de permiso. Aprobación visual y comprobación pública pendientes.

La portada de la nota sobre corales de Galápagos se sustituyó localmente por una [imagen satelital de NASA](../../image-rights-register.md) de 2016, con crédito y alcance visibles. La fotografía anterior mostraba un buzo y un coral, pero no se encontró un registro de autorización para sus bytes y la página secundaria consultada no estuvo accesible; no se infiere por ello que careciera de autorización. Revisión visual del titular y comprobación pública pendientes.

La portada del océano austral se sustituyó localmente por una [imagen de archivo de NASA IceBridge](../../image-rights-register.md) del mar de Bellingshausen en 2014, con fecha y crédito visibles; no documenta los datos del estudio de salinidad. La imagen anterior estaba identificada como generada con IA en el frontmatter publicado, pero no se encontró un recibo que vinculara su hash en los registros consultados. Aprobación visual del titular y comprobación pública pendientes.

## Estrella desaparecida: comparación de portada — 1 de noviembre

La portada anterior `src/assets/images/2026-02-16-agujero-negro-colapso.jpg` (3840 × 2160; SHA-256 `fd429464ae8bc13670fc4aacb2b678fb442acefc2ee18c7a48a56b49346e9f93`) muestra la misma composición que una ilustración publicada por [Space.com](https://www.space.com/astronomy/black-holes/astronomers-witness-vanishing-star-collapse-into-a-black-hole-in-andromeda-galaxy), acreditada allí a Keith Miller, Caltech/IPAC-SELab. La variante consultada tiene 3840 × 2160 y SHA-256 `668f67dcee5c09749fa67fc2d10f26083a5f8579e37af308c8a3418491ec9a1b`; no coincide byte a byte y se desconocen su cadena de transformación y permiso para el sitio. Se preparó una [ilustración conceptual con recibo](../../image-rights/2026-11-01-fading-star-concept.json), sin presentarla como una observación o modelo del objeto. Aprobación visual y comprobación pública pendientes.

## Xigou: ilustración anterior y estudio — 1 de noviembre

La portada anterior `src/assets/images/2026-01-27-235.png` (1280 × 720; SHA-256 `1f4dfe7931fd4c4c8acdcbb8dfb9d94f9ea6f2f085457d70fe07b871b56af03f`) muestra la misma composición que la ilustración publicada por [Live Science](https://www.livescience.com/archaeology/human-evolution/160-000-year-old-sophisticated-stone-tools-discovered-in-china-may-not-have-been-made-by-homo-sapiens), que atribuye el crédito a Hulk Yuan, IVPP. La variante consultada mide 1600 × 900 y su SHA-256 es `15693b1e16436f228574152b297f4814d962ddcdb2e6b79ba2ad555a8a1e2124`; no coincide byte a byte y se desconocen las transformaciones y autorización de uso. El [artículo científico](https://pmc.ncbi.nlm.nih.gov/articles/PMC12848047/) declara licencia CC BY-NC-ND 4.0, con condiciones particulares y posibles materiales de terceros; no se asumió que sus figuras autoricen uso comercial o adaptaciones. Se preparó una [lasca conceptual con recibo](../../image-rights/2026-11-01-xigou-stone-concept.json), que no representa una pieza del yacimiento. Aprobación visual y comprobación pública pendientes.

## Guepardos de Arabia: comparación de portada — 1 de noviembre

La portada anterior `src/assets/images/2026-01-17-article-213.png` (SHA-256 `87b66db52f3ac231b1bc44b1b5b88b3e7f02f5fa28d7c0606f5fb2b1e195fb2e`, 1280 × 720) muestra la misma escena que la imagen publicada por [Live Science](https://www.livescience.com/animals/cats/ancient-mummified-cheetahs-discovered-in-saudi-arabia-contain-preserved-dna-from-the-long-lost-population), atribuida allí al National Center for Wildlife de Arabia Saudita. La variante consultada mide 1600 × 900 y su SHA-256 es `b422ae064692ca3984662a50c406df33beb9b17ba90b01d5728c413a0fab41e5`; los bytes no coinciden y no se ha acreditado la cadena de transformación ni el permiso de reutilización. La coincidencia visual no permite trasladar automáticamente una licencia del artículo científico a esta fotografía. Se preparó una [ilustración conceptual con recibo](../../image-rights/2026-11-01-cheetah-cave-concept.json), que no representa un ejemplar ni una cueva del estudio. Aprobación visual y comprobación pública pendientes.

El 2 de noviembre se inspeccionó la página de guepardos en una compilación local a 375 y 1280 px: la ilustración y su leyenda se ven completas, la leyenda identifica que es conceptual y generada con IA, no se detectó desbordamiento horizontal ni imágenes completas rotas y el canonical apunta a la ruta prevista. Tras rechazar el banner, la página permitió continuar la lectura. La consola mostró el error CORS de Cloudflare Web Analytics ya registrado para localhost; esta comprobación no demuestra su comportamiento público, licencia de la ilustración ni aprobación visual del titular.

La portada de la nota sobre encuestas y esports se sustituyó localmente por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-esports-survey-concept.json), sin una persona o un tratamiento que pudiera confundirse con evidencia del estudio. Falta aprobación visual del titular y verificación después del despliegue.

## Marca predeterminada: dos variantes sin origen documentado

La portada local de Bienvenidos `src/assets/images/default.png` muestra el logotipo tipográfico de Noticiencias en azul y gris; su SHA-256 es `bae717e6ba555df40d1e80e6fa3c6c304204b2a9db63ec1a34b92d33480bdbc8`. La variante pública usada en metadatos, `public/assets/images/default.png`, tiene el mismo motivo visual, pero bytes distintos (SHA-256 `f3c39164b2413c600556f5acb5f71096a1465f3249107deb7ae87da5e175d6c7`). El commit `d59546b6` actualizó la primera y `2561cfc9` incorporó la segunda; esos commits muestran cambios de archivos, no acreditan la autoría ni las condiciones de las tipografías o elementos originales. Se corrigió el texto alternativo de Bienvenidos. La trazabilidad de ambas variantes sigue pendiente y el inventario de portadas no debe marcarse como resuelto por esta observación.

## Edison: posible fuente histórica de la portada — 1 de noviembre de 2026

La portada local `src/assets/images/2026-01-24-article-36.jpg` muestra la misma composición de cuatro bombillas que la [ficha de Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Edison_incandescent_lights.jpg). La ficha atribuye la fotografía a William J. Hammer, la fecha en 1904 y señala su reproducción en un libro estadounidense de 1910; también declara modificaciones de recorte y brillo. Identifica dominio público en Estados Unidos y advierte que la situación puede variar en otras jurisdicciones.

Los archivos no coinciden byte a byte: la portada anterior mide 1152 × 632 y su SHA-256 es `7f499d395fe081216b7607675db293df4da2835a9fd71f80862192168b8889e6`; la variante de Commons descargada mide 737 × 388 y su SHA-256 es `47c51b33b0decb60d7b41faffab3b10f7195f298c95277181dfa475f5496042d`. La coincidencia visual es una pista, no demuestra la cadena exacta de transformación ni resuelve la situación de derechos fuera de Estados Unidos. Se sustituyó localmente por una [ilustración conceptual con recibo](../../image-rights/2026-11-01-edison-bulb-concept.json); falta aprobación visual del titular y comprobación pública.

La propuesta anterior para 2026 ED138 usaba un campo real de Rubin. Al revisar de nuevo la [política de medios](https://rubinobservatory.org/gallery/media-policy) se observó que incluye, además de la licencia CC BY 4.0 y atribución, una cláusula de exención de responsabilidad. Por prudencia no se mantiene esa reproducción preparada sin revisar esa condición; el enlace informativo al mosaico anotado continúa. La portada se sustituyó por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-distant-object-concept.json), expresamente identificada como observatorio imaginario. No se ha publicado ni se acredita aprobación visual del titular.

La portada de la nota sobre 2025 MN45 se sustituyó localmente por una [ilustración conceptual generada con IA](../../image-rights/2026-10-31-asteroid-rotation-concept.json), sin presentarla como su forma ni composición. Falta aprobación visual del titular y verificación después del despliegue.
