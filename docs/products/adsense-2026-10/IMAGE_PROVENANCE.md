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
