# Plan 027 · Declarar el ancho real de las miniaturas en fila

**Estado** DONE · verificado localmente · **Prioridad** P2 · **Esfuerzo** S · **Riesgo** bajo · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-23 · **Hallazgo** H07

## Resultado

Las tarjetas en fila anuncian el ancho que realmente ocupan y permiten seleccionar una imagen más pequeña cuando el dispositivo la puede usar. Las imágenes principales y las demás variantes conservan su resolución y comportamiento.

## Estado y alcance

- `src/components/ds/organisms/ArticleCard.astro:53–58` asigna 96 px a la imagen antes de `sm` y 160 px desde `sm`. En `98–111` todas las variantes salvo `lead` pasan `(max-width: 768px) 100vw, 420px` a `Image.astro`. La variante `row` se usa en `src/pages/blog/[...page].astro:55`, `src/pages/temas/[tag]/[...page].astro:82` y `src/pages/series/[series].astro:60`.
- `src/components/common/Image.astro:114–132` propaga `sizes` al `source` AVIF cuando genera esa variante. En el artefacto local preliminar, las seis alternativas 900w sumaron 477.853 bytes y las 320w, 79.750. Son tamaños de archivo del artefacto, con transferencia efectiva sin medir.
- Editar `ArticleCard.astro` y añadir una regresión en `tests/playwright/article-card-images.test.ts`. Conservar las variantes, el `srcset`, el fallback, los recortes CSS, los textos alternativos y el modo de entrega de imágenes. El plan cambia únicamente `sizes` para `row`.

## Implementación y aceptación

1. Derivar `sizes` de las dos ranuras CSS de la fila con el mismo corte `sm`. Conservar los valores actuales de `lead`, `standard` y `compact`. Confirmar en el HTML generado que el nodo que anuncia `srcset` recibe el valor nuevo. La variante `consequence` conserva su comportamiento sin imagen.
2. En Chromium con cache vacío, medir en `/blog/` el ancho efectivo de las primeras tarjetas y la variante asociada a `currentSrc` a 375 px con DPR 2 y 1280 px con DPR 1. Usar páginas/contextos independientes para no heredar el recurso más grande de otra prueba. Afirmar una variante de hasta 320w cuando esté disponible y cubra el ancho por DPR. Comprobar un caso de DPR alto que siga teniendo una variante suficientemente grande. Verificar además un listado temático o de serie y la portada principal.
3. Registrar los bytes de recursos seleccionados antes y después en el mismo build local y condiciones equivalentes. Informar el resultado medido con el tamaño y DPR, dejando el ahorro en producción como evidencia separada. Si un host entrega una sola URL sin `srcset`, conservar ese fallback y medir una tarjeta con variantes reales.

| Comprobación                                                                                                                | Evidencia de auditoría                                                       | Aceptación                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint && npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit` | Declarada. La auditoría inspeccionó el markup y los archivos del build local | Salida 0.                                                                                   |
| `CI=1 npm run test:e2e -- tests/playwright/article-card-images.test.ts --project=mobile-375 --project=desktop-1280`         | Declarada                                                                    | Preview local a los anchos y DPR explícitos, sin roturas de imágenes, consola o canonicals. |

Comparar `git diff e271512f..HEAD -- src/components/ds/organisms/ArticleCard.astro src/components/common/Image.astro tests/playwright/article-card-images.test.ts`. Si el optimizador deja de emitir `srcset` en las filas, separar el diagnóstico del pipeline de imágenes antes de atribuir ahorro. Revisar el diff y actualizar la fila 027.

## Evidencia local de implementación

Chromium seleccionó las variantes siguientes para las seis miniaturas de `/blog/`. La medición usa los tamaños en disco de los archivos elegidos tras cargar cada imagen. El control usa el HTML del mismo build con el atributo `sizes` anterior y cada escenario abre un contexto nuevo.

| Viewport y DPR | Bytes con el atributo anterior | Bytes con el atributo nuevo |
| -------------- | -----------------------------: | --------------------------: |
| 375 px, DPR 2  |                        449.497 |                      72.400 |
| 1280 px, DPR 1 |                        240.585 |                      72.400 |
| 1280 px, DPR 3 |                        790.188 |                     240.585 |

Los seis casos de Playwright pasaron en los dos perfiles locales con Chromium disponible en caché.

También pasaron lint, typecheck, validación de contenido, build, dist-sanity y los 1.035 tests de auditoría.
