# Plan 022 · Resolver la primera consulta y corregir el teclado del buscador

**Estado** TODO · **Prioridad** P1 · **Esfuerzo** S · **Riesgo** bajo · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-22 · **Hallazgo** H02

## Resultado

El buscador del encabezado muestra la consulta más reciente cuando el índice termina de cargar. El estado «sin resultados» representa una búsqueda ejecutada. El campo admite flechas y Enter y los demás controles conservan su activación habitual.

## Estado actual y alcance

- `src/components/common/HeaderSearch.astro:223–248` ejecuta `search` inmediatamente y muestra vacío si recibe un array vacío. En `261–272` y `295–306`, la promesa de carga llama solo a `renderRecent`. `src/utils/browser/search-index.ts:49–75` comparte una promesa por documento, la invalida al fallar y devuelve un array vacío mientras no hay índice.
- `HeaderSearch.astro:317–331` captura Enter en todo el diálogo si existe un destacado. El formulario de `34–60` carece de destino y nombre para la consulta. Sin destacado, Enter carece de navegación explícita a `/buscar/`.
- `src/components/common/SearchInterface.astro:96–136` proporciona el patrón existente de estado de carga y consume `q` con `getQueryFromUrl`. El enlace «Ver todos los resultados» del diálogo ya usa `/buscar/?q=…`. Mantener la limpieza de ese parámetro y la política de analítica.
- Editar `src/components/common/HeaderSearch.astro` y `tests/playwright/search.test.ts`. Conservar MiniSearch v3, la carga diferida, el techo de 150 KiB gzip, la ruta estática y los atajos de apertura. [ADR-0015](../docs/adr/0015-full-text-search-index.md)

## Implementación y criterios

1. **Estado de consulta.** Al abrir, iniciar una sola carga lógica para el diálogo. Mientras carga, mostrar un estado de carga y conservar la consulta actual en el input. Cuando se resuelva, renderizar según el valor vigente del input. Una resolución tardía de un diálogo cerrado o reemplazado por Astro carece de efecto. Después de un fallo, volver a abrir debe poder reintentar con el cargador existente. Una consulta vacía restablece recientes y el enlace por defecto.
2. **Teclado y envío.** Limitar las flechas y la selección de sugerencias al input o a su flujo explícito. Enter sobre Cerrar, un enlace enfocado o «Ver todos» conserva su semántica nativa, incluso tras usar flechas. El submit del formulario abre el resultado destacado desde el input o, si no hay destacado y la consulta tiene contenido, abre `/buscar/` con esa consulta. Una consulta vacía deja el diálogo listo para escribir. Preservar Escape y la gestión de foco del diálogo nativo.
3. **Regresión de navegador.** Usar los datos del corpus y fixtures de `tests/playwright/search.test.ts`. Retener la respuesta de `search.json` con una compuerta controlada desde el test. Escribir dos consultas antes de liberar la respuesta y comprobar que se renderiza solo la última, sin teclear de nuevo. Cubrir fallo y reapertura, Enter con Cerrar enfocado tras ArrowDown, Enter con sugerencia activa y submit sin sugerencia para un resultado conocido. Verificar la recepción del término por la página y su posterior limpieza de la URL. Usar expectativas sobre el estado o la URL, sin esperas fijas.

| Comprobación                                                                                                                               | Evidencia de auditoría                                                                                                       | Resultado esperado del ejecutor                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                                                                                                                             | Ejecutada con las dependencias locales                                                                                       | Salida 0.                                                               |
| `npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit && npm run check:search-budget` | Declarada en la raíz                                                                                                         | Todos pasan. `/search.json` conserva v3 y queda dentro del presupuesto. |
| `CI=1 npm run test:e2e -- tests/playwright/search.test.ts --project=mobile-375 --project=desktop-1280`                                     | Declarada. Los casos existentes pasaron en Chromium local con viewport explícito. Las dos fallas se reprodujeron en Chromium | Pasa en ambos breakpoints con foco, teclado y navegación verificados.   |

Comprobar deriva con `git diff e271512f..HEAD -- src/components/common/HeaderSearch.astro tests/playwright/search.test.ts`. Si ha cambiado el contrato de traspaso de la consulta, validar primero el mecanismo vigente y revisar el alcance. Trabajar en una rama o worktree aislado. Comprobar también la interacción a 375 y 1280 px. Al cierre, revisar el diff y actualizar la fila 022 con el SHA y los resultados.
