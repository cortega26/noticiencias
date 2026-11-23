# Plan 023 · Respetar el canal y el cupo de distribución social

**Estado** TODO · **Prioridad** P1 · **Esfuerzo** M · **Riesgo** medio · **Dependencias** ninguna

**Base** `e271512f744998e25a1da3175797a25fa6c89f1e` · 2026-11-22 · **Hallazgo** H03

## Resultado

Una pausa de Buffer detiene futuros envíos del canal afectado durante la ejecución actual. El resto de candidatos conserva su orden y el cupo de artículos considera solo candidatos elegibles por canal y selectores.

## Estado actual y alcance

- `scripts/social/publish.js:340–371` arma una lista de candidatos y carga cada artículo contra el límite antes de aplicar `selectors.articleId` y `selectors.platform`. En `412–420`, ante `outcome.channelHalted`, reemplaza con `splice` la lista que recorre `for…of`. Eso desplaza candidatos sin visitar detrás del índice interno del iterador.
- La prueba local mediante el orquestador real e integraciones simuladas usó dos artículos, cada uno con Facebook, X y LinkedIn. Al detener Facebook en el primero, X del primero se omitió. Con selector por el segundo artículo y cupo de uno, el primer artículo consumió el presupuesto y el total de envíos fue cero.
- `tests/social/publish-cli.test.ts:4–12` cubre el modo de CLI. Para el nuevo test, usar como patrones el store de memoria de `tests/social/state.test.ts:74` y las pruebas de evidencia de despliegue de `tests/social/workflow.test.ts`.
- Editar `scripts/social/publish.js` y añadir `tests/social/publish-orchestration.test.ts`. Preservar orden, procedencia, comprobación del manifiesto, contabilidad por ID, CAS, reservas, sondeo, dry-run y condiciones globales de parada. La activación y recuperación de Bluesky requieren su propia decisión.

## Implementación y criterios

1. **Demostrar la regresión en el orquestador.** Usar `runDistribution` exportado con modo publish, contexto confiable simulado, manifiesto y prueba de despliegue coherentes, ledger local en memoria, `fetchImpl` y proveedor mock. Fijar reloj y demoras. Afirmar la secuencia completa de llamadas para dos artículos con tres canales y para un selector por el segundo artículo con cupo de uno. Los fixtures no acceden a la red, GitHub ni Buffer.
2. **Aplicar elegibilidad antes del cupo.** Mantener estable el array generado por `orderCandidates`. Llevar un conjunto de canales detenidos limitado a la ejecución, consultarlo junto con los selectores antes de actualizar `newArticlesTouched` y añadir el canal cuando el resultado lo detenga. Mantener la política existente que consume el cupo de un candidato elegible al intentar verificarlo. Continuar respetando `haltAll` y `manifestChanged`.
3. **Verificar secuencia y límites.** Con Facebook pausado en el primer artículo, comprobar un intento a Facebook y los dos intentos correspondientes por canal restante, en el mismo orden. Con el selector por artículo y cupo de uno, verificar que solo el seleccionado llega a verificación y envío. Comprobar que un ID elegible consume un solo cupo aunque tenga varios canales, y que una parada global impide nuevos intentos.

| Comprobación                                                                                                | Evidencia de auditoría                                                           | Resultado esperado del ejecutor                                              |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run lint`                                                                                              | Ejecutada con las dependencias locales                                           | Salida 0.                                                                    |
| `npm run test:audit -- tests/social`                                                                        | Declarada. Orquestador ejercitado en memoria y CLI/workflow en la suite enfocada | Todos los tests de distribución pasan, incluidas las secuencias nuevas.      |
| `npm run typecheck && npm run validate:content && npm run build && npm run test:dist && npm run test:audit` | Declarada                                                                        | Salida 0 con las dependencias del lockfile y un `dist/` del checkout actual. |

Comprobar deriva con `git diff e271512f..HEAD -- scripts/social/publish.js tests/social/publish-orchestration.test.ts`. Si cambian las reglas de elegibilidad o los límites del ledger, revisar la política del scheduler antes de ajustar la secuencia. Trabajar en una rama o worktree aislado. Al cierre, revisar el diff y actualizar la fila 023 con el SHA y los resultados.
