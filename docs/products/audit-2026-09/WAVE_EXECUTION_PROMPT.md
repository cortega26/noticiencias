# Noticiencias — Prompt operativo por Waves

Usar este archivo como prompt base del asistente/agente.

Sustituir únicamente:

`<TARGET_WAVE>`

por la wave deseada, por ejemplo `Wave 0`, `Wave 1`, etc.

---

Estamos ejecutando el programa incremental de mejora de Noticiencias.

## TARGET

Ejecuta únicamente:

**<TARGET_WAVE>**

No inicies una wave posterior.

## Sources of truth obligatorios

Antes de modificar cualquier archivo, lee en este orden:

1. `AGENTS.md`
2. cualquier source of truth global indicado por `AGENTS.md`
3. `docs/product/audit-2026-09/README.md`
4. `docs/product/audit-2026-09/BACKLOG.md`
5. `docs/product/audit-2026-09/IMPLEMENTATION_LEDGER.md`
6. `docs/product/audit-2026-09/DECISIONS.md`
7. `docs/product/audit-2026-09/BASELINE.md`
8. documentación arquitectónica/editorial relevante a la wave actual.

No dependas del contexto de una conversación anterior si el repo puede resolverlo.

## Regla principal

Trabaja por **wave**, pero conserva atomicidad por **finding**.

Dentro de la wave:

1. inspecciona;
2. planifica;
3. implementa cada finding;
4. valida;
5. haz revisión adversarial;
6. actualiza el ledger;
7. actualiza decisiones si corresponde;
8. pasa al siguiente finding de la MISMA wave solamente si el anterior está estable.

No implementes findings de otra wave “porque ya estás ahí”.

---

# FASE A — Preflight de wave

Antes de editar:

1. confirma qué findings pertenecen a `<TARGET_WAVE>`;
2. verifica sus dependencias;
3. comprueba el estado del ledger;
4. ejecuta los checks baseline pertinentes;
5. identifica cualquier fallo preexistente;
6. determina archivos/componentes/contratos probablemente afectados.

Entrega un preflight breve con:

- findings;
- dependencias;
- riesgos;
- validación prevista;
- branch actual/recomendada.

Si una dependencia obligatoria no está resuelta, marca la wave `BLOCKED` y no fuerces implementación.

Para `Wave 0`, NO cambies comportamiento del producto: solo inspecciona, ejecuta baseline y completa documentación.

---

# FASE B — Implementación finding por finding

Para cada finding de la wave:

## 1. Inspect

Antes de editar:

- localiza implementación real;
- identifica root cause;
- identifica tests existentes;
- revisa contratos/schema/pipeline relevantes;
- comprueba contenido legacy afectado.

No asumas que la solución orientativa del backlog coincide con la arquitectura.

## 2. Plan

Especifica brevemente:

- root cause;
- archivos previstos;
- solución mínima;
- riesgos;
- pruebas de aceptación.

Si la arquitectura pide una solución distinta, preserva el objetivo y acceptance criteria y documenta la diferencia.

## 3. Implement

Haz solo el cambio necesario.

Prioridades:

1. corrección factual/científica;
2. ausencia de regresiones;
3. claridad del contrato;
4. mantenibilidad;
5. simplicidad.

Prohibido:

- inventar DOI, autores, reviewers, datos, muestras o resultados;
- refactors oportunistas;
- cambiar URLs sin necesidad;
- “arreglar” otros findings fuera de wave;
- ocultar duplicaciones o errores solo con CSS;
- reemplazar evidencia faltante por afirmaciones plausibles.

## 4. Verify

Ejecuta lo pertinente:

- unit/integration tests;
- lint;
- typecheck;
- build;
- SSR/static generation;
- HTML/DOM;
- RSS/sitemap;
- metadata/canonical;
- accessibility;
- responsive behavior;
- fixtures legacy;
- fuente científica primaria.

Para UI, verifica al menos mobile y desktop.

Para contenido científico, contrasta claims relevantes con fuente primaria cuando exista.

## 5. Adversarial review

Intenta romper tu propio cambio:

- legacy content;
- null/unknown;
- campos ausentes;
- edge cases;
- duplicated DOM;
- SEO;
- responsive;
- accesibilidad;
- fallbacks;
- contenido sin DOI;
- contenido sin reviewer;
- contenido sin `Qué cambia`;
- datos no confiables.

Corrige problemas descubiertos dentro del scope del finding.

## 6. Ledger

Actualiza `IMPLEMENTATION_LEDGER.md` inmediatamente al terminar el finding:

- status;
- commit si ya existe;
- tests;
- notas.

Si no se hace commit todavía, usa `REVIEW` y deja el hash vacío.

## 7. Decisions

Si tomaste una decisión duradera no cubierta por `DECISIONS.md`, añade una nueva `DEC-XXX`.

No reescribas silenciosamente decisiones anteriores.

## 8. Follow-ups

Problemas fuera de scope:

`FOLLOW-UP: <descripción>`

No implementarlos a menos que bloqueen la wave.

---

# FASE C — Commits

Preferencia:

- un commit lógico por finding;
- conventional commit;
- no mezclar findings.

Si el usuario/agente tiene política de “review before commit”, detenerse antes de commit y reportar.

Si `AGENTS.md` autoriza commit automático para este flujo, se puede hacer un commit por finding después de que sus checks pasen.

Nunca hacer un solo commit gigante de toda la wave salvo limitación externa explícita.

---

# FASE D — Wave Gate

Al terminar todos los findings de la wave, ejecutar validación integral pertinente.

Actualizar:

- `IMPLEMENTATION_LEDGER.md`
- `DECISIONS.md`
- `BASELINE.md` solo si cambió una referencia operativa legítima del baseline; no convertirlo en changelog.

Entregar exactamente esta estructura:

## Wave

`<TARGET_WAVE>`

## Status

`REVIEW`, `BLOCKED` o `DONE-CANDIDATE`

## Findings

Para cada finding:

- ID
- status
- root cause
- files changed
- commit/hash si aplica

## Acceptance criteria

Para cada criterio:

- PASS
- FAIL
- PARTIAL

con evidencia breve.

## Validation

Comandos y resultados reales.

## Regression review

Qué se verificó y qué riesgo permanece.

## Decisions

DEC nuevas o `None`.

## Follow-ups

Solo fuera de scope.

## Diff summary

Resumen de impacto funcional, editorial y técnico.

## Recommended next action

Una sola recomendación:

- merge/review de esta wave;
- corregir un fallo;
- desbloquear dependencia.

## STOP

Detente.

No inicies la siguiente wave hasta recibir una instrucción explícita.

---

# Orden canónico

- Wave 0 — Baseline y guardrails
- Wave 1 — Correctness & Trust Hotfixes
- Wave 2 — Editorial Data Contract
- Wave 3 — Evidence & Accountability UX
- Wave 4 — Article UX
- Wave 5 — Home, Recency & Information Architecture
- Wave 6 — Conversion & Editorial Collections
- Wave 7 — Discovery & Retention
- Wave 8 — Measurement

---

# Primera ejecución

Para empezar el programa:

`<TARGET_WAVE> = Wave 0`

Una vez revisado y aceptado el baseline:

`<TARGET_WAVE> = Wave 1`
