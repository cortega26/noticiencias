# Plan 026 · Liberar el menú al cambiar de ancho y verificar los swaps

**Estado** DONE · verificado localmente · **Prioridad** P2 · **Esfuerzo** S–M · **Riesgo** medio · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-23 · **Hallazgos** H08 y H19

## Resultado

Al pasar a escritorio, el menú móvil se cierra, el documento recupera el desplazamiento y el encabezado vuelve a su tamaño habitual. El estado expandido se anuncia correctamente y los tests de ciclo de vida prueban transiciones reales a 375 y 1280 px.

## Estado y alcance

- `src/components/common/Header.astro:83–90` oculta el botón en `lg` y muestra la navegación de escritorio con `lg:flex`. `src/components/ds/templates/BasicScripts.astro:67–75` alterna `expanded`, `h-screen` y `overflow-hidden`. Su listener en `136–145` escucha el corte de 767 px, y `onLoad` se repite con `astro:after-swap` en `182–189`. En la auditoría, abrir a 900 px y ampliar a 1280 px dejó el scroll bloqueado con el botón oculto.
- `src/components/common/ToggleMenu.astro:14` ofrece el nombre del botón y carece de estado expandido. `tests/playwright/lifecycle.test.ts:43–52,139–163` busca `/blog` y puede saltarse el clic. El enlace vigente es `/blog/`, por ejemplo en `src/components/common/DailyDesk.astro:103`. `playwright.config.ts:45–52` usa el perfil Pixel 5 de 393 px para el proyecto llamado `mobile-375`.
- Editar `BasicScripts.astro`, `Header.astro`, `ToggleMenu.astro`, `tests/playwright/lifecycle.test.ts` y `playwright.config.ts`. Limitar el cambio a la navegación principal. Preservar el buscador, los desplegables de escritorio, el tema, las URLs y las transiciones Astro.

## Implementación y aceptación

1. Hacer que abrir y cerrar apliquen el mismo conjunto de estados a botón, header, navegación y body. Enlazar el botón con su navegación mediante `aria-controls` y sincronizar `aria-expanded` con el estado móvil. El cierre restablece clases de tamaño y scroll y mantiene visible la navegación en escritorio por su CSS.
2. Registrar el listener del corte `lg` una sola vez por documento, con selectores que resuelvan el DOM vigente tras cada swap. Reusar la operación de cierre para el cambio a escritorio, el reset de navegación y la limpieza de página. Conservar los listeners de controles propios de cada DOM con la guarda existente.
3. Fijar el viewport móvil a 375 px conservando el resto del perfil y confirmar que escritorio sigue a 1280 px. En Playwright exigir los clics entre `/` y `/blog/`, comprobar URL y observar el número esperado de `astro:after-swap`. El test debe fallar si no navega. Reproducir 900 → 1280 → 900 px, verificar el scroll, el estado accesible y que el botón sigue abriendo y cerrando una sola vez tras los swaps.

| Comprobación                                                                                                                                  | Evidencia de auditoría                                                   | Aceptación                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npm run lint && npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit`                   | Gates declarados. La auditoría reprodujo el bloqueo con el build aislado | Salida 0.                                                           |
| `CI=1 npm run test:e2e -- tests/playwright/lifecycle.test.ts tests/playwright/navigation.test.ts --project=mobile-375 --project=desktop-1280` | Declarada                                                                | Ambos perfiles pasan con navegación y redimensionamiento efectivos. |

Comparar `git diff e271512f..HEAD -- src/components/ds/templates/BasicScripts.astro src/components/common/Header.astro src/components/common/ToggleMenu.astro tests/playwright/lifecycle.test.ts playwright.config.ts`. Si cambió el corte CSS, alinear el listener con el corte vigente y demostrar que el caso inicial sigue siendo reproducible. Revisar el diff y actualizar la fila 026 con el SHA y la evidencia.

## Evidencia local de implementación

Pasaron lint, typecheck, validación de contenido, build, dist-sanity y la suite de auditoría. Los 24 casos de Playwright de ciclo de vida, navegación y miniaturas pasaron con Chromium disponible en caché. Los casos de ciclo de vida comprobaron diez swaps reales por perfil y la secuencia 900 → 1280 → 900 px.
