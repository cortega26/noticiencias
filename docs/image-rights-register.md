# Registro puntual de derechos de imagen

## Shanidar A: reemplazo preparado el 24-10-2026

Se generó una nueva ilustración conceptual con la herramienta integrada `image_gen` de Codex, desde texto y sin imágenes de referencia. Muestra una escápula genérica y una lupa; no reproduce el fósil de Shanidar A, su lesión ni un ataque. No contiene un arma supuestamente recuperada. El artículo la identifica expresamente como ilustración conceptual generada con IA.

- Original nativo conservado: `docs/image-rights/originals/2026-10-24-shanidar-scapula-study.png`; SHA-256 `537da1d10c65beb0fa541562e8f8a8f47608191fc19709fd50e42dd71ccd2284`.
- Exportación para el artículo: `src/assets/images/2026-10-17-shanidar-scapula-study-original.webp`; SHA-256 `483809951141cd6521d35f09cd360453b5a73271e235629a881830959572f500`; 1672 × 941 px, WebP calidad 90, sin redimensionado.
- [Recibo de generación registrado en esta tarea](./image-rights/2026-10-24-shanidar-image-generation.json): prompt íntegro, herramienta, archivo devuelto, hashes, dimensiones, conversión y límites. Es un registro del agente, no una certificación firmada del proveedor ni una revisión científica.
- La imagen anterior, de procedencia no acreditada, deja de ser una dependencia del artículo y del manifest en esta rama; sus bytes y SHA-256 se conservan en el historial Git y en el recibo. No se ejecutó ningún borrado de R2 ni purga de CDN.

**Estado:** preparado para revisión visual del titular, sin despliegue. La procedencia del nuevo output está documentada; no se afirma exclusividad de derechos ni validación anatómica. La publicación y la pertinencia final siguen pendientes.

Fecha de actualización: 2026-10-19. Este registro cubre 19 alternativas generadas para artículos. Diez exportaciones vectoriales se sustituyen ahora por imágenes raster detalladas. Esta renovación está preparada en el repositorio; no acredita su despliegue ni una aprobación de AdSense. No certifica derechos para el resto del catálogo.

## Renovación de calidad del 19-10-2026

Se sustituyen las dos ilustraciones vectoriales de MicroMasters y automatización, más las ocho de los PR #304 y #306. Las nueve ilustraciones raster anteriores del 12-10 permanecen sin cambios. Las diez nuevas imágenes se generaron con la herramienta integrada `image_gen` de Codex, a partir de descripciones específicas de cada artículo, sin imágenes de referencia ni activos de terceros como entrada en la generación inicial. El encuadre del robot se ajustó después usando únicamente su propia imagen generada.

Son recreaciones editoriales e interpretaciones artísticas generadas con IA. No documentan personas, lugares, eventos, especímenes ni resultados observados. Cada artículo incorpora un crédito visible y un texto alternativo descriptivo que lo aclara. No se atribuyen a las imágenes licencias de fotografías anteriores ni se garantiza exclusividad.

Las salidas tienen resolución nativa de 1536 × 1024 px (3:2), sin ampliación, exportadas con Sharp a WebP de calidad 90 y esfuerzo 6. Se conservan las rutas de los artículos y de los activos; cambian los hashes y los derivados. El modo de entrega continúa siendo `github`: regenerar el manifiesto no acredita cargas ni disponibilidad en R2. Los SVG anteriores se conservan como historial, **no son la fuente de los nuevos WebP**.

| Artículo                      | Activo actual                                                             | SHA-256 del WebP actual                                            |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| MicroMasters y logística      | `src/assets/images/2026-01-15-micromasters-learning-original.webp`        | `4bc1fe4140556eadfa1fbd82957d3214c3c98e14d7abda91f148797eb996f2d6` |
| Automatización y salarios     | `src/assets/images/2026-05-07-automation-wages-original.webp`             | `e39e18aa75363d6a5dd9e46014442c315ba36374bfb95cecfa581ae7a69e96dd` |
| Regeneración de bosques       | `src/assets/images/2026-10-12-secondary-forest-recovery-original.webp`    | `d303612d65976fbae551c56b8867f5ba0c17baba753493e5a068316a31eaf703` |
| Simulaciones de geoingeniería | `src/assets/images/2026-10-12-solar-geoengineering-wargame-original.webp` | `dd5d038bd4bfad8fef48763140810cd202e94a96639658380bbf1060f87e5c19` |
| Optogenética                  | `src/assets/images/2026-10-05-optogenetics-light-neuron-original.webp`    | `b69e8b2c407cd7eca6ff14db51a9ff7bcb1fc7efb03db93c2e4bede8b75111e7` |
| Papiros y tomografía          | `src/assets/images/2026-09-20-vesuvius-scroll-xray-original.webp`         | `f6183187cb566e983ec05474dfac2e6c8d6dade418788370209e2b723057cdd4` |
| Beta Pictoris b y auroras     | `src/assets/images/2026-09-21-exoplanet-radio-aurora-original.webp`       | `b2a84f95b01d0461bf49a01814893ef89b9e19d2d4f4e0067c3e46aa04f96c99` |
| Planeta joven Elias 2-24 b    | `src/assets/images/2026-09-17-young-planet-disk-gap-original.webp`        | `a000b1fdb5acd079d5d3dabbd9351f54b91e024a0dccfcf49b6ec1627665aa62` |
| Canal de Panamá               | `src/assets/images/2026-09-10-panama-canal-el-nino-original.webp`         | `d2b10ba238f0c43b3dbba2ae0abb53fead45c3439ef88a668eb2ae2713d5d153` |
| Robot bípedo                  | `src/assets/images/2026-09-05-humanoid-robot-sprint-original.webp`        | `aaa00049493e2330d8e2d15ea3c0a9b674e773507c426787898bddc06c6655b3` |

Los [prompts completos y datos de procedencia](./image-rights/quality-refresh-2026-10-19.json) registran el hash del PNG generado, el hash de la exportación anterior y el actual, dimensiones, parámetros de exportación, texto alternativo y crédito. La [comparación antes/después](./image-rights/quality-refresh-2026-10-19.webp) reúne los diez cambios.

## Activos retirados

- **Artículo del 15-01-2026 sobre el MicroMasters.** El [perfil de MIT News](https://news.mit.edu/2026/how-online-mit-course-supply-chain-management-sparked-new-career-0115) identifica la fotografía con el crédito «Photo: Emma Perakis». Sus [términos de uso](https://news.mit.edu/terms-of-use) ofrecen las imágenes descargables bajo CC BY-NC-ND para uso no comercial. No había autorización comercial separada documentada en este repositorio. Se retiraron el JPEG local y su entrada del manifiesto; ya no quedan derivados de esta fotografía en el repositorio ni en el manifiesto activo. Los cuatro objetos R2 autorizados también se eliminaron y sus URL exactas devolvieron 404 tras la purga verificada (ver sección de limpieza).
- **Artículo del 07-05-2026 sobre automatización.** El [artículo de MIT News](https://news.mit.edu/2026/study-firms-often-use-automation-control-certain-workers-wages-0507) acredita la imagen «MIT News; iStock». Esa atribución no acredita una licencia comercial de iStock y no se encontró una autorización separada en el repositorio. Se retiraron el JPEG local y su entrada del manifest; no se conserva ningún recorte ni derivado.

## Versiones anteriores y nueve imágenes raster conservadas

Las subsecciones siguientes conservan la procedencia y los hashes de sus respectivas fechas. Las dos imágenes MIT y los ocho WebP vectoriales del 18-10 se reemplazaron por los activos actuales de la tabla anterior; sus afirmaciones de fuente SVG y estado de publicación son históricas. Las nueve imágenes raster del 12-10 siguen vigentes.

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

### Nueve ilustraciones editoriales generadas el 12-10-2026

Las siguientes imágenes se generaron desde descripciones textuales para Noticiencias, sin imágenes de referencia, fotografías, logotipos ni otros archivos de terceros como entrada. Son ilustraciones editoriales; no representan fotografías documentales, mapas científicos exactos ni reconstrucciones verificadas de especímenes. Se registran como outputs generados, no como garantía de exclusividad o de ausencia de reclamaciones de terceros.

Los [términos de OpenAI](https://openai.com/policies/terms-of-use/) indican que, entre OpenAI y el usuario y en la medida permitida por la ley, el usuario posee el output y OpenAI cede los derechos que tenga sobre él. También advierten que outputs similares pueden producirse para otras personas y excluyen garantías, incluida la de no infracción. Este registro no reemplaza una evaluación legal ni acredita derechos sobre elementos que pudieran estar protegidos por ley.

| Artículo                                          | Activo                                                                       | Exportación          | SHA-256                                                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| Guardería y microbioma (25-01-2026)               | `src/assets/images/2026-01-25-daycare-microbiome-original.webp`              | WebP, 1500 × 1000 px | `df003ed69203434e038e3f001c243afcb05e481901866f9ebbdb159987fbfe99` |
| Cilios de coral (20-09-2026)                      | `src/assets/images/2026-09-20-coral-cilia-flow-original.webp`                | WebP, 1500 × 1000 px | `71e6404b1ecafade94f7dc39d38c00249b86bff4d8451c4779816f55dd7562ff` |
| Holografía AdS/CFT (25-09-2026)                   | `src/assets/images/2026-09-25-ads-cft-holography-original.webp`              | WebP, 1500 × 1000 px | `5d1c09daf53b0abd535e33c8323992401a1f28e0c66871bd8405de6619da8956` |
| Sensor Piezo1 (27-01-2026)                        | `src/assets/images/2026-01-27-piezo1-mechanosensor-original.webp`            | WebP, 1500 × 1000 px | `8370243a7b55904a6748da217d62f21c03912dcdcea7d81411209e7c770ef431` |
| Arpones de hueso de Brasil (23-01-2026)           | `src/assets/images/2026-01-23-brazil-bone-harpoon-original.webp`             | WebP, 1500 × 1000 px | `f85131c1de76b688f68fe205afe4a4e97e2b3b8b07aec3b7057cb958123b8a1d` |
| Microesferas de alginato (18-09-2026)             | `src/assets/images/2026-09-18-pancreatic-islet-alginate-beads-original.webp` | WebP, 1500 × 1000 px | `22e763a61c85c9adf605b75fa5072d145a0003ad1305150acdb0ad4d68d87c43` |
| Ataque a Hugging Face (12-08-2026)                | `src/assets/images/2026-08-12-ai-sandbox-package-registry-original.webp`     | WebP, 1500 × 1000 px | `09db4079b24e295673256fa38d885ce6d01b03eb8e09a46443d7a411df45ecf9` |
| Inyección indirecta de prompts (24-04-2026)       | `src/assets/images/2026-04-24-indirect-prompt-injection-original.webp`       | WebP, 1500 × 1000 px | `ee2ffb4ce0234ac10523e427166023daed0eace65d548d7e4249fec462d14da6` |
| Mapa GRACE de almacenamiento de agua (23-09-2026) | `src/assets/images/2026-09-23-grace-water-storage-original.webp`             | WebP, 1500 × 1000 px | `4d805f6f0ab6f543829c5ba275e7b9d544a570af6f479bedd0dd2d1d853aa905` |

Las solicitudes del usuario del 12-10-2026 autorizaron reemplazar estas nueve imágenes para preparar el sitio para una posible monetización. Los seis reemplazos anteriores se desplegaron y verificaron en producción; estas tres nuevas ilustraciones están registradas y pendientes de publicación. El inventario completo y las 31 imágenes aún sin revisión individual están en [Inventario de imágenes del 12-10-2026](./image-rights-inventory-2026-10-12.md).

### Cuatro ilustraciones vectoriales originales del 18-10-2026

Se generaron con Claude Code desde descripciones textuales, sin imágenes de referencia, fotografías, logotipos ni otros archivos de terceros como entrada. Cada fuente editable es un SVG en `docs/image-rights/originals/`; el activo publicado es su exportación WebP de 1500 × 1000 px mediante Sharp. Son ilustraciones esquemáticas: no representan fotografías documentales, datos reales ni reconstrucciones verificadas. Se registran como outputs generados, no como garantía de exclusividad o de ausencia de reclamaciones de terceros; este registro no reemplaza una evaluación legal. Pendiente de confirmación del titular: que los términos vigentes de Anthropic para la cuenta usada permiten el uso comercial del output.

| Artículo                         | Activo                                                                    | Fuente editable                                                           | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Bosques secundarios (12-10-2026) | `src/assets/images/2026-10-12-secondary-forest-recovery-original.webp`    | `docs/image-rights/originals/2026-10-12-secondary-forest-recovery.svg`    | `78166607e59afcf65e6d063e25f204465c97d30ae67a062075bb7aad8f0cf736` |
| Geoingeniería solar (12-10-2026) | `src/assets/images/2026-10-12-solar-geoengineering-wargame-original.webp` | `docs/image-rights/originals/2026-10-12-solar-geoengineering-wargame.svg` | `01348051686cab4bd560a8156216424319d1784c41c507dde1af3b37fafe994a` |
| Optogenética (05-10-2026)        | `src/assets/images/2026-10-05-optogenetics-light-neuron-original.webp`    | `docs/image-rights/originals/2026-10-05-optogenetics-light-neuron.svg`    | `b338efdffc7f7610f98d20c19b46aa078bcfe65612bb9c38f1dfbbacea28dc39` |
| Rollos del Vesubio (20-09-2026)  | `src/assets/images/2026-09-20-vesuvius-scroll-xray-original.webp`         | `docs/image-rights/originals/2026-09-20-vesuvius-scroll-xray.svg`         | `d85083e18866b1644ca26f41e361742864dbb0bcdaa427e8acbb53ebd01b408c` |

Imágenes anteriores retiradas del repositorio el 18-10-2026 (siguen en el historial de git). Las cuatro habían sido descargadas por el pipeline desde la nota de la fuente, sin licencia de reutilización registrada en este repositorio (procedencia `UNVERIFIED`; no es una conclusión de infracción):

- **Bosques secundarios:** retrato de la persona perfilada en la nota de [MIT Technology Review](https://technologyreview.com/2026/10/12/1145745/daisy-dent-ecologist-revealing-invisible-networks-revive-rainforests/), sin relación con los dos estudios que resume el artículo.
- **Geoingeniería solar:** GIF de la nota de [WIRED](https://wired.com/story/they-war-gamed-dimming-the-sun-it-went-even-worse-than-you-think/).
- **Optogenética:** fotografía de la nota de [Ars Technica](https://arstechnica.com/science/2026/10/controlling-the-brain-with-light-earns-a-physiology-nobel/).
- **Rollos del Vesubio:** fotografía de la nota de [SciTechDaily](https://scitechdaily.com/mount-vesuvius-buried-these-scrolls-for-2000-years-now-scientists-may-read-them/).

### Cuatro ilustraciones vectoriales originales adicionales del 18-10-2026 (lote B)

Mismas condiciones que el lote anterior: generadas con Claude Code desde descripciones textuales, sin imágenes de referencia ni activos de terceros; fuente editable en `docs/image-rights/originals/`; exportación WebP de 1500 × 1000 px mediante Sharp; ilustraciones esquemáticas, no fotografías documentales ni datos reales; sin garantía de exclusividad. La confirmación de los términos de Anthropic sigue pendiente del titular.

| Artículo                                  | Activo                                                              | Fuente editable                                                     | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Radio y aurora en Beta Pictoris b (21-09) | `src/assets/images/2026-09-21-exoplanet-radio-aurora-original.webp` | `docs/image-rights/originals/2026-09-21-exoplanet-radio-aurora.svg` | `bc2841280edd6fc194f8688f0bb6692a4a3848365ee2d49e116f81e096b360b9` |
| Elias 2-24 b, planeta joven (17-09)       | `src/assets/images/2026-09-17-young-planet-disk-gap-original.webp`  | `docs/image-rights/originals/2026-09-17-young-planet-disk-gap.svg`  | `2efbc4ed41107775ebb91304643959f8894c6b15fe9a8fa773ea2fd0f78eb2ae` |
| El Niño y el canal de Panamá (10-09)      | `src/assets/images/2026-09-10-panama-canal-el-nino-original.webp`   | `docs/image-rights/originals/2026-09-10-panama-canal-el-nino.svg`   | `6eba124879562fbd029bd88ebc177987e29776469ea6c606f87e94d92e3dfe29` |
| Robot humanoide y Usain Bolt (05-09)      | `src/assets/images/2026-09-05-humanoid-robot-sprint-original.webp`  | `docs/image-rights/originals/2026-09-05-humanoid-robot-sprint.svg`  | `c12b1e8cb124880a10dce8a43ffc51a338d86ebd6ed428f9f930539fbf7393e1` |

Las cuatro imágenes anteriores se retiraron del repositorio el 18-10-2026 (siguen en el historial de git). Sus nombres de archivo correspondían a títulos de notas periodísticas, es decir, las había descargado el pipeline desde la fuente, y no hay licencia de reutilización registrada en este repositorio (procedencia `UNVERIFIED`; no es una conclusión de infracción). La de la nota del robot humanoide procedía de [Live Science](https://livescience.com/technology/robotics/faster-than-usain-bolt-heres-all-the-records-robot-athletes-broke-at-this-years-world-humanoid-robot-games-in-china).

## Riesgos concretos de procedencia de cinco imágenes reemplazadas

Estos datos describen la procedencia y permisos de las imágenes que usaban antes esos artículos; no son una conclusión de infracción. Los artículos ahora apuntan a las ilustraciones nuevas registradas arriba. El estado `UNVERIFIED` corresponde a los activos anteriores, no a una licencia demostrada para ellos. La lista exacta de los 18 artículos no está registrada en los PR ni en los documentos activos, así que esta comprobación se limita a los cinco riesgos identificables en los PR editoriales #246, #247, #252, #253 y #254.

- **Guardería/microbioma (25-01-2026):** [Scientific American](https://www.scientificamerican.com/article/babies-who-attend-daycare-share-good-germs-too/) acredita la imagen anterior a StockPlanets/Getty Images. No hay licencia independiente de Noticiencias registrada aquí: procedencia `UNVERIFIED`; referencia sustituida por `2026-01-25-daycare-microbiome-original.webp`.
- **Cilios de coral (20-09-2026):** [WIRED](https://www.wired.com/story/tiny-hairs-that-help-corals-breathe-may-malfunction-in-warming-oceans/) identifica la imagen anterior como cortesía de Quanta; la [versión de Quanta](https://www.quantamagazine.org/corals-spin-tiny-vortices-to-get-oxygen-but-not-if-its-too-hot-20260805/) la acredita a Cesar Pacharres, coloreada por Quanta. El artículo científico relacionado indica CC BY-NC, pero no se documentó una licencia comercial para la imagen de Quanta: procedencia `UNVERIFIED`; referencia sustituida por `2026-09-20-coral-cilia-flow-original.webp`.
- **Holografía (25-09-2026):** [Quanta Magazine](https://www.quantamagazine.org/gravity-seems-holographic-what-does-that-mean-for-reality-20260925/) acredita la imagen anterior a Ada Zejun Shen; no hay permiso separado de reutilización registrado: procedencia `UNVERIFIED`; referencia sustituida por `2026-09-25-ads-cft-holography-original.webp`.
- **Piezo1 (27-01-2026):** [ScienceDaily](https://www.sciencedaily.com/releases/2026/01/260127010149.htm) acredita la imagen anterior como Shutterstock; no hay licencia independiente de Noticiencias registrada aquí: procedencia `UNVERIFIED`; referencia sustituida por `2026-01-27-piezo1-mechanosensor-original.webp`.
- **Arpones (23-01-2026):** [Live Science](https://www.livescience.com/archaeology/some-of-the-oldest-harpoons-ever-found-reveal-indigenous-people-in-brazil-were-hunting-whales-5-000-years-ago) acredita la fotografía anterior al Museu Arqueológico de Sambaquis de Joinville. Esa línea no expresa una licencia para Noticiencias: procedencia `UNVERIFIED`; referencia sustituida por `2026-01-23-brazil-bone-harpoon-original.webp`. La licencia CC BY-NC-ND de [Nature Communications](https://www.nature.com/articles/s41467-025-67530-w) se refiere a sus imágenes incluidas allí; no se atribuye automáticamente a la fotografía del museo.

Las referencias locales anteriores ya se cambiaron por alternativas documentadas y se verificaron en producción tras su despliegue. La sustitución no otorga derechos sobre los activos anteriores. Las nuevas referencias de los artículos de microesferas, seguridad de IA, inyección de prompts y almacenamiento de agua están registradas localmente; sus imágenes públicas podrán confirmarse después de publicar cada cambio pendiente.

Las declaraciones públicas de financiación se actualizaron posteriormente en el PR #256. La activación futura de anuncios debe mantener alineados consentimiento, privacidad y política editorial.

## Limpieza de cuatro derivados CDN: completada

El usuario autorizó expresamente el 9 de octubre de 2026 eliminar **solo** cuatro objetos R2 de la fotografía MIT del 15 de enero, hash histórico `5121406c65027caa`, anchos 400, 900, 1400 y 1500 px, además de purgar sus cuatro URL exactas. No autorizó borrar otros objetos ni ejecutar purgas amplias.

La limpieza acotada se completó posteriormente: se eliminaron esos cuatro objetos y, tras purgar sus URL exactas, las cuatro respondieron **HTTP 404** en producción el 12 de octubre de 2026. No se borraron otros objetos ni se ejecutaron purgas amplias. Los nombres de clave y las URL históricas constan en el historial de ejecución; no quedan como acciones pendientes.
