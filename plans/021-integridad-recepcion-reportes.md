# Plan 021 · Asegurar el recibo y la utilidad de los reportes

**Estado** DONE (verificado localmente) · **Prioridad** P1 · **Esfuerzo** M · **Riesgo** medio · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-22 · **Hallazgos** H01, H06 y H10

## Resultado

Una persona recibe un ID cuando el reporte fue recibido por un destino duradero. El formulario exige URL y descripción, omite los controles de la categoría inactiva y preserva sus valores como borrador si la persona vuelve a seleccionarla. Las fallas del almacenamiento auxiliar producen diagnósticos acotados sin registrar URLs introducidas por usuarios.

## Diagnóstico original y alcance

- `workers/src/handlers/report.ts:50–74` ejecuta el limitador y consulta la idempotencia en KV antes de almacenar. En `97–128` evalúa los destinos y devuelve 503 si ambos fallan. En `130–146` espera `KV.put` antes de responder 201, incluso cuando R2 ya guardó el ID. Una simulación del handler real confirmó una escritura en R2 seguida de un rechazo. El log de `136–139` incluye `record.article_url`.
- `workers/src/utils/rateLimit.ts:61–74` deriva una clave por cliente y minuto y hace una escritura por admisión. Cloudflare limita las escrituras a una por segundo por clave. El contrato actual usa KV con consistencia eventual y una ventana de idempotencia de 600 segundos basada en el cuerpo exacto. [Límites de KV](https://developers.cloudflare.com/kv/platform/limits/), [contrato de reportes](../docs/report-pipeline-setup.md#L11)
- `src/components/common/ReportForm.astro:77–109` rotula URL y descripción como obligatorias. En `324–369` alterna la visibilidad y los atributos de requisitos del contenido, pero los controles ocultos siguen habilitados. El envío usa `checkValidity()` y `new FormData(form)` en `395–422`. El validador público del Worker admite campos opcionales, mientras el formulario tiene requisitos editoriales propios. Conservar esa compatibilidad.
- Editar únicamente `workers/src/handlers/report.ts`, `workers/tests/report.handler.test.ts`, `src/components/common/ReportForm.astro`, `tests/playwright/report-form.test.ts` y `docs/report-pipeline-setup.md`. Los bindings, el formato de los reportes y el esquema del Collector quedan fuera del cambio. Preservar la política de correo y R2.

## Implementación y criterios

1. **Recibo del Worker.** Manejar por separado los fallos de KV anteriores a la persistencia y el fallo de registro tras el éxito. Antes de los destinos, devolver un 503 JSON mediante el `errorResponse` existente para una excepción del limitador o de la consulta de idempotencia. Mantener 429 para una decisión de cuota y 201 con el ID original para una entrada de idempotencia válida. Después del éxito duradero, si falla el registro auxiliar, emitir un diagnóstico con fase y ID y devolver el 201 con ese ID. Usar mensajes diagnósticos acotados, sin cuerpo, URL ni detalle del proveedor. Conservar 503 si fallan ambos destinos. Documentar el resultado cuando falla el registro de reintentos.
2. **Validación del formulario.** Aplicar los requisitos declarados de URL y descripción, incluyendo descripción vacía tras `trim()`. Habilitar solo los campos de la categoría activa y marcar los requisitos de contenido solo mientras se muestran. Dejar que `FormData` excluya los campos deshabilitados y mantener los nombres actuales. Conservar el estado inicial sin selección, la indisponibilidad por endpoint vacío y la confirmación que depende de una respuesta con ID. Seguir el ciclo idempotente del componente para Astro ClientRouter.
3. **Regresión de Worker.** Usar el patrón de bindings simulados de `workers/tests/report.handler.test.ts:47–59`. Hacer fallar separadamente el limitador, la lectura de idempotencia y la escritura posterior. Verificar 503 con cero escrituras duraderas en los dos primeros casos y 201 con una escritura y su ID en el último. Verificar que la URL de usuario no llega a logs. Conservar las pruebas de reintento y de fallo de ambos destinos.
4. **Regresión de navegador.** Usar el endpoint simulado del fixture de `tests/playwright/report-form.test.ts`. Verificar cero solicitudes con cada campo compartido vacío, el envío técnico válido tras cambiar desde contenido con una URL de evidencia inválida, la omisión de todos los campos inactivos en ambas direcciones y el retorno al borrador al cambiar de nuevo. Comprobar que se muestra el ID de la respuesta simulada.

| Comprobación                                                                                                | Evidencia de auditoría                                                                                   | Resultado esperado del ejecutor                                           |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run lint`                                                                                              | Ejecutada con las dependencias locales                                                                   | Salida 0.                                                                 |
| `npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit` | Declarada en la raíz                                                                                     | Todos los comandos pasan en un checkout con Node 24 y lockfile instalado. |
| `npm run typecheck && npm run test:coverage` desde `workers/`                                               | Ejecutada en copia aislada con la instalación local. 75 tests pasaron                                    | Pasan el typecheck, la suite real de Workerd y sus umbrales.              |
| `CI=1 npm run test:e2e -- tests/playwright/report-form.test.ts --project=mobile-375 --project=desktop-1280` | Declarada. Los tests existentes pasaron en Chromium local con preview aislada y viewport móvil explícito | Pasan ambos breakpoints con endpoint simulado y sin errores de consola.   |

Comprobar la base con `git diff e271512f..HEAD -- workers/src/handlers/report.ts workers/tests/report.handler.test.ts src/components/common/ReportForm.astro tests/playwright/report-form.test.ts docs/report-pipeline-setup.md`. Si cambiaron la semántica de recibo o los consumidores del API, conciliar el contrato antes de editar. Si las pruebas requieren otros bindings o acceso a producción, detenerse y registrar esa dependencia. Trabajar en una rama o worktree aislado. Comprobar también la interacción a 375 y 1280 px con el endpoint simulado. Al cierre, revisar el diff y actualizar la fila 021 con el SHA y los resultados.

**Pendiente** La garantía de idempotencia entre solicitudes concurrentes y el cambio de backend de rate limiting requieren una decisión propia. El plan reduce el daño del fallo de KV y conserva la política de admisión.

## Cierre local

Implementado sobre `2da7714dea317d8b908bd8617507137e1b4fcc6f`. Validación local de lint, tipos, contenido, compilación y dist, con 1.035 pruebas de auditoría y 93 pruebas del Worker. Las 30 comprobaciones del formulario a 375 y 1280 px usan un endpoint simulado.
