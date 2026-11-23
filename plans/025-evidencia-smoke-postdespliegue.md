# Plan 025 · Exigir evidencia útil en el smoke postdespliegue

**Estado** TODO · **Prioridad** P1 · **Esfuerzo** M · **Riesgo** medio · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-22 · **Hallazgo** H05

## Resultado

El verificador aprueba portadas que devuelven contenido de imagen y rutas retiradas cuya respuesta final es 404 o 410. El registro de búsqueda informa de la disponibilidad y validez estructural del índice v3.

## Estado actual y alcance

- `scripts/post-deploy-check-lib.js:159–176` usa HTTP 2xx para disponibilidad. Después de `probeUrl`, el flujo de portada en `974–990` reutiliza esa señal como prueba de imagen sin leer el tipo de contenido. La ejecución local con fetch simulado confirmó tres falsos aprobados para respuestas `200 text/html`.
- `verifySearchCategoryCoverage` en `708–728` devuelve una advertencia si no encuentra `categories`. El caller en `1045–1055` emite `PASS` y consume solo `categoryCount`. Los resultados de v3 publicados por `src/utils/build-search-index.ts:28–36,102–109` omiten el campo deliberadamente. Mantener `verifySearchJson` y eliminar el chequeo legado y su línea de cobertura.
- `verifyDeletedRouteUnavailable` en `816–885` usa `classifyHttpResult`, que no distingue 404 y 410 de otros fallos definitivos. Su rama curl además emite aprobado si el fallback es transitorio. En híbrido, los bloqueos del edge observados pero no resueltos producen una advertencia.
- Editar solo `scripts/post-deploy-check-lib.js` y `tests/post-deploy-check.test.ts`. Conservar el contrato de CLI, el origen canónico, el índice MiniSearch, el reintento y la política híbrida/estricta existente. [ADR-0015](../docs/adr/0015-full-text-search-index.md)

## Implementación y criterios

1. **Portada.** Aplicar una validación local de respuesta de imagen en la rama exitosa de `probeUrl`, con el tipo normalizado de cabecera `Content-Type` y un cuerpo no vacío. Usar la respuesta del transporte que realmente resolvió el probe. La validación semántica falla ante HTML, tipo ausente o cuerpo vacío, con una causa que distingue el recurso afectado. La advertencia de edge no comprobable mantiene su estado existente.
2. **Búsqueda.** Retirar la función y el bloque de impresión de cobertura legado. Mantener la validación obligatoria de JSON, versión, estructura e ítems. Las categorías se podrán comprobar con una fuente canónica en otro cambio si se define la cobertura requerida.
3. **Retirada.** Aplicar a fetch y curl la misma regla de evidencia, con 404/410 como estados de éxito de la baja, 2xx como ruta aún disponible, fallos transitorios reintentables y otros estados definitivos como verificación fallida. Conservar los redirects seguidos por ambos transportes y la política vigente de advertencia híbrida para bloqueos del edge sin resolver. Un 503 tras fallback consume el camino de reintento y nunca acredita un 404/410.
4. **Regresión.** Extender los fixtures de `tests/post-deploy-check.test.ts:31–63,530–581` con las mismas APIs inyectadas. El caso válido emite aprobación de búsqueda sin afirmar cobertura de categorías. Probar portada con MIME de imagen y cuerpo, portada HTML con 200, imagen con cuerpo vacío, 404/410 reales en el fixture y rechazo de 401/403 no atribuibles al edge. Probar curl con 503 tras bloqueo, seguido de 404 en el siguiente intento y, en un caso separado, tras agotar reintentos. Conservar la prueba de ruta retirada que aún devuelve 200 y los casos híbridos del suite.

| Comprobación                                                                                                                | Evidencia de auditoría                                           | Resultado esperado del ejecutor                                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run test:audit -- tests/post-deploy-check.test.ts`                                                                     | Suite enfocada ejecutada y falsa aprobación reproducida          | Pasan los flujos nuevos y existentes con fetch/curl simulados.                                              |
| `npm run lint && npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit` | Lint ejecutado. Los demás comandos corresponden al gate del repo | Salida 0 y `dist/` actual.                                                                                  |
| `npm run test:deploy -- <URL de preview del mismo build>`                                                                   | Declarada. La auditoría no apuntó a producción                   | Validar en una preview con estado HTTP y tipos MIME representativos antes de activar el gate en despliegue. |

Comprobar deriva con `git diff e271512f..HEAD -- scripts/post-deploy-check-lib.js tests/post-deploy-check.test.ts`. Si la preview sirve portadas válidas con un tipo genérico, recoger respuesta, origen y motivo antes de ampliar la política de MIME. Si no hay preview representativa, registrar el límite y conservar los fixtures de ambos transportes. Trabajar en una rama o worktree aislado. Al cierre, revisar el diff y actualizar la fila 025 con el SHA y los resultados.
