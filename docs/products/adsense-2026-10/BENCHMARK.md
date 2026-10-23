# Comparables hispanos de ciencia y tecnología (18-oct-2026)

**Alcance:** comprobación acotada (I1 del plan), no una auditoría. Se probaron 16 dominios hispanos de ciencia/tecnología con `curl` (ads.txt, HTML de portada, sitemap, RDAP). Seis no respondieron o bloquean la consulta automática. No se evaluó la calidad editorial de cada sitio ni se puede saber por qué Google aprobó a cada uno.

## Resultados

| Dominio                 | AdSense en la portada | `ads.txt` con vendedor `google.com` | URLs en el sitemap  | Registro del dominio (RDAP) | Nota                                               |
| ----------------------- | --------------------- | ----------------------------------- | ------------------- | --------------------------- | -------------------------------------------------- |
| noticiasdelaciencia.com | Sí                    | Sí                                  | 949                 | 2010                        | Portal de noticias; firma de autor visible.        |
| tendencias21.es         | Sí                    | Sí                                  | sin sitemap común   | n/d                         | Revista digital de ciencia y tecnología.           |
| astrobitacora.com       | Sí                    | Sí                                  | 6 sitemaps          | 2015                        | Noticias de astronomía; contacto y firma de autor. |
| cuentoscuanticos.com    | Sí                    | Sí                                  | 7 sitemaps de posts | 2021                        | Blog personal con entradas desde 2011.             |
| muyinteresante.com      | No (otro stack)       | Sí                                  | 52 sitemaps         | 1998                        | Medio grande; monetiza con ad server propio.       |
| hipertextual.com        | No (otro stack)       | Sí                                  | 14 sitemaps         | 2005                        | Medio grande.                                      |
| ecoosfera.com           | No (otro stack)       | Sí                                  | 89 sitemaps         | 2010                        | Medio mediano.                                     |
| agenciasinc.es          | No                    | No (404)                            | 1.550               | n/d                         | Agencia pública; sin publicidad.                   |
| **noticiencias.com**    | No (sin anuncios)     | Sí (solo `ads.txt`)                 | 85                  | 2025-08-30                  | 50 posts; sitio publicando desde enero de 2026.    |

Sin datos: cienciaplus.com, amazings.es, levante-emv.com, tecnovedades.com, elmundo.es, nationalgeographic.com.es, muyinteresante.es, sciencemadness.org (no responden, bloquean la consulta o no encajan).

## Lectura

- Los cuatro sitios que cargan AdSense en su portada tienen **historia larga** (dominio de 2010, 2015 o 2021, y contenido propio desde 2011 en el caso del blog) y entre cientos y miles de URLs. Ninguno es un dominio de menos de un año.
- Todos muestran autoría o un canal de contacto visibles. Ninguno de ellos declara en portada que sus textos sean adaptaciones.
- Es una muestra pequeña y con sesgo de supervivencia: no demuestra que la edad o el volumen sean requisito, solo que, entre los sitios comparables que sí monetizan con AdSense, ninguno es nuevo. Encaja con la causa C del diagnóstico (audiencia e historial) y con la hipótesis de que el revisor evalúa señales que no dependen del texto de la solicitud.
- Siguiente paso útil, cuando exista tiempo humano: comparar 3 posts de `astrobitacora.com` con sus fuentes en inglés para ver cuánto valor añaden (I4 aplicado a un comparable).

## Evidencia de la comunidad (I2, búsqueda acotada)

No se encontró ningún caso verificable de un sitio de noticias traducidas que fuera rechazado y luego aprobado tras cambios concretos; lo disponible son opiniones de foros y blogs, no política de Google.

- Un usuario de [ForoBeta](https://forobeta.com/temas/adsense-rechaza-mi-sitio-sin-motivo.853728/) atribuye el rechazo por «bajo valor» a texto duplicado en otros sitios del mismo tema y recomienda reescribir las noticias con criterio propio y usar imágenes distintas de las de la fuente (coincide con las causas A y B).
- En otro hilo de [ForoBeta](https://forobeta.com/temas/como-mejorar-mi-sitio-para-cumplir-con-adsense.918473/) se comenta que el criterio es inconsistente: sitios de 14 artículos aprobados y de más de 100 rechazados. No hay umbral fijo de volumen.
- La [guía de la comunidad oficial de AdSense](https://support.google.com/adsense/community-guide/326104930/%C2%BFc%C3%B3mo-solucionar-el-problema-de-desaprobaci%C3%B3n-de-adsense-por-contenido-de-bajo-valor?hl=es) habla de evaluar experiencia, autoridad y confiabilidad, y de que el tráfico de baja calidad pesa en contra.

## Comparación editorial actualizada — 22-oct-2026

Esta sección sustituye las inferencias anteriores sobre edad del dominio, cantidad de URLs y no declarar adaptación como razones para obtener AdSense. La presencia de publicidad en un comparable no revela el motivo de su aprobación y no aconseja ocultar asistencia de IA.

| Comparable y muestra consultada                                                                                                                                        | Explicación, fuentes y autoría observadas                                                                                                                                                                     | Qué podemos aportar de forma distinta                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [SINC: lesión de Shanidar](https://www.agenciasinc.es/Noticias/Una-lesion-en-un-hueso-neandertal-podria-ser-la-evidencia-mas-antigua-de-un-ataque-con-lanza-de-madera) | Firma María G. Dionis, enlace al estudio, imágenes acreditadas y respuestas atribuidas a Pomeroy. Expone accidente/ataque y límites del cuidado inferido.                                                     | Nuestra revisión usa una tabla que separa observación, hipótesis de arma, intención y cuidado; debe aportar utilidad a quien compara titulares, sin fingir entrevista propia.                                          |
| [Astrobitácora: técnica eléctrica para biofirmas](https://www.astrobitacora.com/una-tecnica-electrica-para-detectar-biofirmas/)                                        | Firma Alex Riveiro y perfil; explica quiralidad, método y prueba; enlaza estudio Ohshiro et al., [Nature Communications](https://doi.org/10.1038/s41467-026-77947-6), y referencia Phys.org.                  | Nuestra guía distingue evidencia espectral remota de una técnica de laboratorio para muestras: no confundir instrumentos futuros y detección actual de vida; comparación reusable y actualización de interpretaciones. |
| Noticias de la Ciencia                                                                                                                                                 | Consulta directa a portada respondió 403; no se recuperó un artículo comparable de forma verificable. Extractos de republicaciones no permiten calificar su práctica editorial ni inferir la fuente primaria. | **Comparación pendiente**, no se asigna puntuación ni se finge lectura. Mantenerlo en la muestra acordada y completar con acceso legítimo disponible.                                                                  |

La muestra de SINC comparte exactamente el tema de nuestra pieza problemática; la de Astrobitácora comparte la pregunta de cómo se construye una posible biofirma, aunque el método científico es distinto. El artículo primario de Ohshiro se recuperó y describe conductancia nanogap de moléculas; no es espectroscopia atmosférica de un exoplaneta. No se usa esta comparación para afirmar superioridad general de un medio.

**Hipótesis de diferenciación a probar:** comparaciones claras de «afirmación/evidencia/alternativa/prueba pendiente», fuentes originales rastreables y correcciones que expliquen qué cambió. Aún no es un moat demostrado: faltan lectores recurrentes, relaciones propias y mantenimiento observado. El coste sostenible se concentra en dos portafolios, no en más temas ni mayor volumen.
