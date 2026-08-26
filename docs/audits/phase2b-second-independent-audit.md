# Auditoría independiente de segunda vuelta — Phase 2B

**Commit auditado:** `51074f0`  
**Alcance:** 30 posts indicados en `phase2b-second-audit-prompt.md`  
**Resultado:** evidencia para revisión humana; este documento no constituye una aprobación ni un sign-off.

## Criterio aplicado

- Se comparó el frontmatter publicado y el cuerpo completo de cada post con su propia `source_url`.
- `V` = `VERIFIED`; `U` = `UNSUPPORTED`; `C` = `CONTRADICTED`; `—` = no existe `fact_check` en posts `schema_version: 1`.
- Bajo el estándar estricto de la consigna, las afirmaciones regionales o de política de `why_it_matters` que no aparecen en la fuente se consideran inferencias no respaldadas. Esto afecta los 15 posts v2.
- Todos los `sources[]` son correctos salvo el título de la fuente de Piezo1.

## Grupo A — schema_version: 2

| Post | Veredicto por `fact_check` | Hallazgos de cuerpo / metadata | Evaluación |
| --- | --- | --- | --- |
| `2026-01-24-thomas-edison-podria-haber-creado-el-grafeno-accidentalmente-en-1879.md` | V / V / V / V / **U**. La fuente no afirma que el grafeno se aislara oficialmente por primera vez en 2004. | Sin discrepancia material en el cuerpo. `why_it_matters` contiene proyecciones regionales no presentes en la fuente. | Necesita metadata. |
| `2026-01-25-investigadores-logran-la-superposicion-cuantica-mas-grande-registrada.md` | V / V / V / **U** / V. La fuente no dice que escalar computación cuántica sea «más factible de lo esperado»; advierte que escalar sigue siendo difícil. | Antes: «Este avance sugiere que la escalada de sistemas cuánticos puede ser más factible de lo esperado». Después: «El resultado muestra que la mecánica cuántica sigue siendo válida a esta escala; la fuente señala que escalar sistemas más masivos seguirá siendo difícil». | Necesita metadata y cuerpo. |
| `2026-01-25-la-guarderia-un-lugar-donde-los-bebes-intercambian-microorganismos-y-desarrollan-su-microbioma.md` | V / V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` añade implicancias de política regional no cubiertas por la fuente. | Necesita metadata. |
| `2026-01-27-herramientas-empunadas-de-piedra-sofisticadas-descubiertas-en-china-datan-de-hace-160-000-anos.md` | V / V / V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` contiene inferencias regionales no presentes en la fuente. | Necesita metadata. |
| `2026-01-27-piezo1-identificado-como-sensor-de-ejercicio-interno-crucial.md` | V / V / V / V. | Sin discrepancia material. `sources[0].title` es inexacto: la fuente se titula *This discovery could let bones benefit from exercise without moving*, no *Piezo1 identified as crucial internal 'exercise sensor'*. | Necesita metadata. |
| `2026-01-28-moltbot-asistente-personal-de-inteligencia-artificial-ofrece-funcionalidades-innovadoras-pero-tambien-plantea-desafios-de-seguridad.md` | V / V / V / V. | Antes: «Steinberger mismo ha advertido sobre la importancia de la seguridad y ha recomendado que los usuarios sean cautelosos». La fuente atribuye la recomendación concreta de aislamiento a Rahul Sood, no a Steinberger. Después: «La fuente recoge la advertencia de Rahul Sood de usar un equipo o servidor separado y cuentas desechables». | Necesita metadata y cuerpo. |
| `2026-01-28-observatorio-de-la-energia-oscura-refina-comprension-de-expansion-cosmica.md` | V / V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` contiene inferencias regionales no presentes en la fuente. | Necesita metadata. |
| `2026-01-31-como-claude-code-esta-llevando-el-vibe-coding-a-todos.md` | V / V / V / V. | Sin discrepancia material; las comparaciones aparecen explícitamente como experiencia personal del autor de la fuente. `why_it_matters` añade proyecciones regionales no cubiertas por ella. | Necesita metadata. |
| `2026-02-05-estudio-revela-que-un-tercio-del-cancer-es-prevenible-con-cambios-en-el-estilo-de-vida.md` | V / V / V / V. | Antes: «El estudio, liderado por Hanna Fink». La fuente identifica a Fink como coautora. Después: «Un estudio en el que Hanna Fink figura como coautora». | Necesita metadata y cuerpo. |
| `2026-02-16-un-ingrediente-inesperado-puede-hacer-el-pan-mucho-mas-saludable.md` | V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` incluye consecuencias regionales no atribuidas por la fuente. | Necesita metadata. |
| `2026-02-18-un-almacenamiento-de-datos-durable-y-coste-efectivo-para-preservar-informacion-durante-10-000-anos.md` | V / V / V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` incluye inferencias regionales no presentes en la fuente. | Necesita metadata. |
| `2026-04-06-nuevos-experimentos-desafian-la-afirmacion-sobre-la-deteccion-de-materia-oscura.md` | V / V / V / V. | Sin discrepancia material en el cuerpo. `why_it_matters` contiene proyecciones regionales no presentes en la fuente. | Necesita metadata. |
| `2026-04-24-sitios-web-ocultan-ordenes-secretas-que-manipulan-a-las-ia-sin-que-los-usuarios-lo-sepan.md` | V / V / V / V / V. | Antes: «No encontraron ataques masivos ni campañas organizadas». Esto es demasiado absoluto: la fuente se limita al archivo de Common Crawl. Antes: «solo en tres o cuatro sitios» para exfiltración; la fuente no da esa cifra. Antes: «no funcionaría… las IA modernas no ejecutan comandos»; la fuente solo dice que este tipo simple de inyección es poco probable que tenga éxito. | Necesita metadata y cuerpo. |
| `2026-05-07-el-mit-descubre-que-la-automatizacion-no-mejora-la-productividad-como-se-creia.md` | V / V / V / V. | El título, resumen y cuerpo exageran «principalmente» y «no mejora». La fuente dice que las firmas lo han hecho *con frecuencia* y que el impulso de productividad fue mediocre. Sustituir por: «las empresas han usado con frecuencia la automatización para sustituir trabajadores con prima salarial, en lugar de maximizar la productividad». | Necesita metadata y cuerpo. |
| `2026-06-14-1-121-especies-marinas-nuevas-descubiertas-y-la-mayoria-ya-estaban-en-los-estantes-de-los-museos.md` | V / V / V / V / V. | C: «Dentro, el gusano no solo se alimenta de ella: también emite una luz tenue». La fuente dice que el poliqueto aporta nutrientes a la esponja y que *algunos* poliquetos son bioluminiscentes. Sustituir por: «Dentro, se encontró una especie de poliqueto transparente que aporta nutrientes a la esponja; algunas especies afines también son bioluminiscentes». | Necesita metadata y cuerpo. |

## Grupo B — schema_version: 1

| Post | Veredicto por `fact_check` | Hallazgos de cuerpo / acceso a fuente | Evaluación |
| --- | --- | --- | --- |
| `2026-01-27-conoce-a-los-misteriosos-electridos.md` | — | La fuente ahora es accesible; cuerpo consistente. | Clean. |
| `2026-01-27-desafio-global-contra-el-sarampion-por-falta-de-confianza-en-las-vacunas.md` | — | Fuente inaccesible (HTTP 406); no se puede verificar el cuerpo sin especular. | No verificable; mantener v1. |
| `2026-01-27-nuevas-plataformas-estratosfericas-podrian-revolucionar-la-conectividad-en-areas-remotas.md` | — | La fuente ahora es accesible; cuerpo consistente. | Clean. |
| `2026-02-12-bienvenidos.md` | — | La URL de fuente es una página de categoría, no un artículo correspondiente. | No verificable; mantener v1. |
| `2026-03-27-el-error-de-redondeo-que-esconde-el-verdadero-terremoto-legal-para-meta-y-youtube.md` | — | Cuerpo consistente con la fuente, incluidos los montos, porcentajes, casos y la fase de *public nuisance*. | Clean. |
| `2026-06-12-los-chatbots-rescataron-a-elias-thorne-de-una-conversacion-casual-y-lo-convirtieron-en-una-ficcion-masiva.md` | — | La vista previa verifica el fenómeno, las 20.000 historias y el 88 %, pero el resto está tras muro de pago. Las afirmaciones sobre WildChat, 166 menciones y ejemplos posteriores no se pueden contrastar. | No verificable; mantener v1. |
| `2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras.md` | — | Corrección confirmada: Kevin Power es actualmente estudiante de máster en Technology and Policy. | Clean. |
| `2026-01-17-cientificos-descubren-adn-preservado-en-guepardos-momificados.md` | — | Corrección de alcance confirmada: la fuente informa extracción de información genética de guepardos momificados, sin convertirlo en una promesa de reintroducción. | Clean. |
| `2026-01-18-nasa-se-prepara-para-un-paso-historico-en-la-exploracion-espacial-humana-con-artemis-ii.md` | — | La cita de Jared Isaacman sobre la distancia es auténtica. No queda la cita fabricada sobre un viaje de Artemis II a Marte. | Clean. |
| `2026-01-23-descubren-los-arpones-mas-antiguos-una-revelacion-que-cambia-nuestra-perspectiva-sobre-la-caza-de-ballenas.md` | — | La especie y el hallazgo están corregidos, pero la cita «este hallazgo es significativo…» se atribuye a André Carlo Colonese sin que la fuente la presente como cita suya. Cambiar por «El estudio concluye…». Añadir la cautela de que no está claro que cada arpón se usara contra ballenas y no otros animales marinos. | Necesita cuerpo. |
| `2026-02-16-un-agujero-negro-se-forma-sin-explotar-una-estrella-masiva.md` | — | La explicación corregida de convección y caída retardada del material externo coincide con la fuente. | Clean. |
| `2026-05-15-un-asteroide-de-700-metros-rota-cada-1-88-minutos-desafiando-teorias-astronomicas.md` | — | Antes: «un objeto de 700 metros no podría sobrevivir». La fuente dice que no esperaban hallar una rotación menor a 10 minutos. Antes: «Rubin detectó 3I/ATLAS 10 días antes que otros telescopios»; C: ATLAS lo anunció primero y la detección de Rubin se encontró luego en datos previos. Sustituir por: «Tras el anuncio por ATLAS, búsquedas en datos previos de Rubin mostraron una detección 10 días anterior». | Necesita cuerpo. |
| `2026-01-31-estudio-revela-menor-agrupamiento-de-galaxias-de-lo-esperado.md` | — | «requiere una revisión y un ajuste» no está respaldado. La fuente informa una tensión no resuelta, sin concluir que el modelo estándar sea incorrecto. | Necesita cuerpo. |
| `2026-04-02-comunicacion-laser-como-desbloqueara-datos-gigantes-y-video-hd-para-las-misiones-lunares-tripuladas.md` | — | La fuente respalda vídeo HD, transmisión óptica en tiempo real y cifras ILLUMA-T. No respalda «terabytes» ni que O2O no reemplace RF y solo la complemente. Reexpresar como posibilidad o retirar. | Necesita cuerpo. |
| `2026-05-23-un-cohete-con-un-motor-apagado-y-otro-fallando-llego-al-espacio-y-volvio.md` | — | No respaldado: «Todos los vuelos anteriores explotaron…» y «Los sistemas de control lo compensaron». Cambiar «Aterrizó suavemente» por «aterrizó en el punto previsto del océano Índico». C: «NASA ha diseñado toda Artemis III alrededor de él»; la fuente contempla Starship o Blue Moon, o ambos. La explicación sobre refrigeración y centros de datos excede la fuente; esta solo informa la aspiración de SpaceX. | Necesita cuerpo. |

## Fuentes directas consultadas

- [Ars Technica — Edison y grafeno](https://arstechnica.com/science/2026/01/did-edison-accidentally-make-graphene-in-1879/)
- [ScienceDaily — Piezo1](https://www.sciencedaily.com/releases/2026/01/260127010149.htm)
- [Microsoft Research — Project Silica](https://www.microsoft.com/en-us/research/blog/project-silicas-advances-in-glass-storage-technology/)
- [Yale Wright Lab — DAMA, ANAIS-112 y COSINE-100](https://wlab.yale.edu/posts/2026-03-31-experiments-refute-dark-matter-claim)
- [Google Security Blog — inyecciones indirectas](https://blog.google/security/prompt-injections-web/)
- [MIT News — automatización y primas salariales](https://news.mit.edu/2026/study-firms-often-use-automation-control-certain-workers-wages-0507)
- [NASA — Artemis II](https://www.nasa.gov/news-release/what-you-need-to-know-about-nasas-artemis-ii-moon-mission/)
- [MIT News — O2O y MAScOT](https://news.mit.edu/2026/lincoln-laboratory-laser-communications-terminal-launches-artemis-ii-0402)
- [Quanta Magazine — observatorio Rubin](https://www.quantamagazine.org/rubin-tracks-skyscraper-size-asteroids-failed-supernovas-and-interstellar-visitors-20260515/)
- [Scientific American — Starship V3](https://scientificamerican.com/article/spacex-launches-starship-v3-the-worlds-most-powerful-and-tallest-rocket-ever/)
