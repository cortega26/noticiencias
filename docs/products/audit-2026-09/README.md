# Noticiencias — Programa de mejora editorial, UX y Growth

Fecha de creación: 2026-09-22

Este directorio convierte la auditoría de Noticiencias en un programa de implementación incremental, auditable y testeable.

## Dónde colocar estos archivos

Copiar este directorio completo dentro del repositorio de Noticiencias:

```text
<repo-noticiencias>/
└── docs/
    └── product/
        └── audit-2026-09/
            ├── README.md
            ├── BACKLOG.md
            ├── IMPLEMENTATION_LEDGER.md
            ├── DECISIONS.md
            ├── BASELINE.md
            └── WAVE_EXECUTION_PROMPT.md
```

No mover estos documentos a la raíz del repo salvo que la arquitectura documental existente lo exija.

`AGENTS.md` permanece en la raíz y conserva precedencia como source of truth global del proyecto.

## Propósito de cada archivo

- `BACKLOG.md`: definición canónica de findings, dependencias, non-goals y acceptance criteria.
- `IMPLEMENTATION_LEDGER.md`: estado vivo de waves y findings, commits, tests, bloqueos y notas.
- `DECISIONS.md`: decisiones de producto/arquitectura que no deben rediscutirse implícitamente entre sesiones.
- `BASELINE.md`: estado técnico/editorial previo a cambios; sirve para distinguir regresiones de deuda preexistente.
- `WAVE_EXECUTION_PROMPT.md`: prompt operativo que se entrega al asistente/agente al iniciar o continuar una wave.
- `README.md`: protocolo global y orden de ejecución.

## Principio operativo

La conversación NO es la memoria del proyecto.

El repo debe contener suficiente contexto para que un asistente nuevo pueda:

1. entender el objetivo;
2. saber qué ya se hizo;
3. identificar qué wave sigue;
4. implementar sin repetir decisiones;
5. verificar que no introdujo regresiones.

## Reglas de ejecución

1. Ejecutar una wave por sesión o bloque de trabajo.
2. Dentro de cada wave, cada finding debe quedar como un cambio lógico y preferentemente un commit independiente.
3. No iniciar una wave posterior si la actual tiene `FAIL`, `BLOCKED` o regresiones no aceptadas.
4. Antes de editar: inspeccionar implementación real y documentación existente.
5. Después de editar: tests, build, revisión adversarial y actualización del ledger.
6. Si surge un problema fuera de scope, registrarlo como `FOLLOW-UP`; no ampliarlo silenciosamente.
7. No inventar datos científicos, DOI, autores, revisores, muestras, fechas o fuentes.
8. Mantener compatibilidad con contenido legacy cuando sea razonable.
9. Preservar URLs, canonical, RSS, sitemap y metadata salvo cambio explícitamente planificado.
10. Para cambios de UI, verificar desktop y mobile.
11. Para cambios editoriales/científicos, verificar contra fuente primaria cuando corresponda.
12. El asistente debe detenerse al terminar una wave y entregar un gate report antes de continuar.

## Estrategia Git recomendada

Una rama por wave:

```bash
git checkout main
git pull --ff-only
git checkout -b audit/wave-01-trust-hotfixes
```

Dentro de la rama:

```text
fix(content): correct Herculaneum article terminology and claims
fix(health): clarify experimental model in insulin-cell article
fix(article): remove duplicate responsive content from DOM
fix(content-discovery): stop labeling recent posts as related
fix(privacy): align analytics claims with actual implementation
```

Al terminar la wave:

1. ejecutar validación completa;
2. actualizar `IMPLEMENTATION_LEDGER.md`;
3. registrar decisiones nuevas en `DECISIONS.md`;
4. entregar reporte;
5. detenerse para revisión/merge.

## Waves

### Wave 0 — Baseline y guardrails

No cambia producto. Inventariará el estado actual: tests, build, lint, typecheck, rutas críticas, estructura editorial y problemas conocidos.

### Wave 1 — Correctness & Trust Hotfixes

Findings:

- P0-04
- P0-05
- P0-07
- P0-08
- P0-10

Objetivo: eliminar errores concretos y contradicciones antes de modificar arquitectura.

### Wave 2 — Editorial Data Contract

Findings:

- P0-01
- P0-02
- P0-06

Objetivo: estructurar la fuente primaria, tipo de evidencia y reglas de implicaciones sin relleno.

### Wave 3 — Evidence & Accountability UX

Findings:

- P0-03
- P0-09
- P2-02
- P2-07

Objetivo: convertir la metodología en señales visibles de confianza.

### Wave 4 — Article UX

Findings:

- P1-05
- P1-04

Objetivo: reducir fricción y hacer visible la evidencia antes del cuerpo.

### Wave 5 — Home, Recency & Information Architecture

Findings:

- P1-01
- P1-02
- P1-03
- P1-09

Objetivo: convertir la home en portada editorial y limpiar taxonomía/copy legacy visible.

### Wave 6 — Conversion & Editorial Collections

Findings:

- P1-06
- P1-07
- P1-08
- P1-10

Objetivo: mejorar newsletter, semántica de temas y Series.

### Wave 7 — Discovery & Retention

Findings:

- P2-01
- P2-06
- P2-05

Objetivo: mejorar descubrimiento temático y mecanismos de retorno.

### Wave 8 — Measurement

Findings:

- P2-03
- P2-04

Objetivo: medir lectura, retorno y conversión sin PII.

## Gate entre waves

Una wave solo puede marcarse `DONE` cuando:

- todos sus findings están `DONE` o explícitamente `DEFERRED` con motivo;
- los acceptance criteria tienen evidencia;
- los tests relevantes pasan;
- build/lint/typecheck pertinentes pasan;
- no hay regresiones conocidas nuevas sin documentar;
- ledger actualizado;
- nuevas decisiones persistidas;
- follow-ups registrados.

## Cómo arrancar

1. Copiar estos archivos a `docs/product/audit-2026-09/`.
2. Entregar al asistente `WAVE_EXECUTION_PROMPT.md`.
3. Sustituir `<TARGET_WAVE>` por `Wave 0`.
4. Hacer que complete baseline y se detenga.
5. Revisar.
6. Continuar con `Wave 1`.

No entregar simplemente `BACKLOG.md` con la orden “implementa todo”.
