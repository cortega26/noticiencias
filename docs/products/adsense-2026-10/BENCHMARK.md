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
