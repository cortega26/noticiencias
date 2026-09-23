# Noticiencias — Implementation Ledger

Fecha inicial: 2026-09-22

Este archivo es estado vivo. Debe actualizarse al final de cada finding y obligatoriamente al final de cada wave.

## Estados permitidos

- TODO
- READY
- IN_PROGRESS
- REVIEW
- BLOCKED
- DONE
- DEFERRED

## Estado de waves

| Wave | Nombre                       |      Estado | Rama                         | Gate | Notas                                                |
| ---- | ---------------------------- | ----------: | ---------------------------- | ---- | ---------------------------------------------------- |
| 0    | Baseline y guardrails        |      REVIEW | audit/wave-00-baseline       | —    | Docs-only; sin cambios de producto                   |
| 1    | Correctness & Trust Hotfixes | IN_PROGRESS | audit/wave-01-trust-hotfixes | —    | P0-04/05/07/08/10; P0-10 mínimo sobre main (DEC-014) |
| 2    | Editorial Data Contract      |        TODO | —                            | —    | Después de hotfixes                                  |
| 3    | Evidence & Accountability UX |        TODO | —                            | —    | Depende parcialmente de Wave 2                       |
| 4    | Article UX                   |        TODO | —                            | —    | Depende de P0-01/P0-02/P0-06                         |
| 5    | Home, Recency & IA           |        TODO | —                            | —    | Después de Article UX                                |
| 6    | Conversion & Collections     |        TODO | —                            | —    | Después de Home                                      |
| 7    | Discovery & Retention        |        TODO | —                            | —    | Depende de taxonomía                                 |
| 8    | Measurement                  |        TODO | —                            | —    | Última wave del programa inicial                     |

## Findings

| ID    | Wave | Estado | Depends on  | Commit           | Tests/Validation                                                                                                              | Notas                                                                             |
| ----- | ---: | ------ | ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P0-04 |    1 | REVIEW | —           | bb3e860          | lint + validate:content PASS; fuente scitechdaily verificada (PLOS ONE DOI 10.1371/journal.pone.0353485 guardado para Wave 2) | papiro/pergamino, attenuación, eruptó; Epicuro se conserva fiel a fuente citada   |
| P0-05 |    1 | REVIEW | —           | 2b45508          | lint + validate:content PASS; claims contra preprint bioRxiv (PDF métodos/discusión)                                          | huésped NOD SCID declarado; nota ya no pide validación animal; KC n=2 descriptivo |
| P0-07 |    1 | REVIEW | —           | PENDIENTE-COMMIT | build PASS; dist verificado (h1×1, sin h2 Fuentes, TrustPanel×1); `tests/article-sources-single.test.ts` 2/2 PASS             | rail ya no renderiza `sources`; par rail/sidebar aceptado (DEC-015)               |
| P0-08 |    1 | TODO   | —           | —                | —                                                                                                                             | “Relacionado”                                                                     |
| P0-10 |    1 | TODO   | —           | —                | —                                                                                                                             | Privacidad                                                                        |
| P0-01 |    2 | TODO   | —           | —                | —                                                                                                                             | Fuente primaria                                                                   |
| P0-02 |    2 | TODO   | —           | —                | —                                                                                                                             | Tipo de evidencia                                                                 |
| P0-06 |    2 | TODO   | —           | —                | —                                                                                                                             | Qué cambia                                                                        |
| P0-03 |    3 | TODO   | P0-01,P0-02 | —                | —                                                                                                                             | Ficha científica                                                                  |
| P0-09 |    3 | TODO   | —           | —                | —                                                                                                                             | Responsabilidad editorial                                                         |
| P2-02 |    3 | TODO   | P0-06       | —                | —                                                                                                                             | Sabemos/no sabemos                                                                |
| P2-07 |    3 | TODO   | —           | —                | —                                                                                                                             | Correcciones                                                                      |
| P1-05 |    4 | TODO   | P0-06       | —                | —                                                                                                                             | Pre-body                                                                          |
| P1-04 |    4 | TODO   | P0-01,P0-02 | —                | —                                                                                                                             | Header evidencia                                                                  |
| P1-01 |    5 | TODO   | P1-04,P1-05 | —                | —                                                                                                                             | Home                                                                              |
| P1-02 |    5 | TODO   | P1-01       | —                | —                                                                                                                             | Recency                                                                           |
| P1-03 |    5 | TODO   | —           | —                | —                                                                                                                             | Taxonomía                                                                         |
| P1-09 |    5 | TODO   | —           | —                | —                                                                                                                             | Headlines                                                                         |
| P1-06 |    6 | TODO   | P1-01       | —                | —                                                                                                                             | Newsletter inline                                                                 |
| P1-07 |    6 | TODO   | P1-06       | —                | —                                                                                                                             | Newsletter landing                                                                |
| P1-08 |    6 | TODO   | —           | —                | —                                                                                                                             | Seguir temas                                                                      |
| P1-10 |    6 | TODO   | —           | —                | —                                                                                                                             | Series                                                                            |
| P2-01 |    7 | TODO   | P0-08       | —                | —                                                                                                                             | Related semántico                                                                 |
| P2-06 |    7 | TODO   | P1-03       | —                | —                                                                                                                             | Topic hubs                                                                        |
| P2-05 |    7 | TODO   | P1-08,P2-06 | —                | —                                                                                                                             | Follow real                                                                       |
| P2-03 |    8 | TODO   | P1-06,P2-01 | —                | —                                                                                                                             | GA4 funnel                                                                        |
| P2-04 |    8 | TODO   | P2-03       | —                | —                                                                                                                             | KPIs                                                                              |

## Wave report template

Copiar y completar al finalizar cada wave:

```md
## Wave N — <nombre>

Date:
Branch:
Status: REVIEW

### Findings

- P?-?? — DONE/PARTIAL/BLOCKED — commit
- ...

### Validation

- unit:
- integration:
- lint:
- typecheck:
- build:
- visual:
- SEO/SSR:
- other:

### Regressions checked

- ...

### Decisions added

- DEC-...

### Follow-ups

- FU-...

### Gate

- [ ] Acceptance criteria evidenced
- [ ] No unexplained test failures
- [ ] No known new regression
- [ ] Ledger updated
- [ ] Decisions updated
- [ ] Ready for human review
```

## Regla de actualización

Nunca marcar `DONE` porque “parece funcionar”.

Debe existir evidencia concreta: test, build, diff, inspección del HTML generado, verificación visual o contraste con fuente, según el finding.

## Wave 0 — Baseline y guardrails

Date: 2026-09-23
Branch: audit/wave-00-baseline (base: main @ 8c1550b)
Status: REVIEW

### Findings

Wave 0 no tiene findings de producto; entregables de inspección:

- BASELINE.md completado con hechos verificados — REVIEW
- DEC-013 (ubicación docs) añadida — REVIEW
- Formato prettier de los 6 docs del programa (docs-only) — REVIEW

### Validation

- unit: `npm run test:audit` → 59 ficheros / 688 tests PASS
- integration: `npm run validate:content` → exit 0 (incl. `astro check`, 0 errores)
- lint: FAIL preexistente solo por formato de estos docs (se corrige en esta wave); resto OK incl. `check:doc-drift` (13 docs)
- typecheck: PASS vía `astro check`
- build: `npm run build` → 232 páginas, exit 0
- visual: no aplica (sin cambios de producto)
- SEO/SSR: `dist/rss.xml` + `dist/sitemap-index.xml` generados; `test:dist` PASS (232 ficheros, social-manifest vs 40 rutas)
- other: e2e consentimiento no ejecutado (FU-001, flaky conocido bajo carga)

### Regressions checked

Ningún cambio de producto en esta wave (solo `docs/products/audit-2026-09/`).
Riesgo residual: ninguno funcional; el formato prettier toca solo esos 6 ficheros.

### Decisions added

- DEC-013

### Follow-ups

- FU-001: suite e2e consentimiento móvil-375 marginal en tiempo bajo carga
  (`main` reproduce los fallos; page pesada + timeouts 15 s). Endurecer en
  wave dedicada sin debilitar aserciones. Bloquea CI de `feat/trust-tone` (PR #201).
- FU-002: rama `feat/trust-tone` modifica `nosotros/privacidad/footer/newsletter`
  (área P0-10). Wave 1 debe rebasear/coordinar antes de tocar esos ficheros.
- FU-003: tensión DEC-003/P0-06 vs schema (`summary_points` mínimo 2 enforced
  en `content.config.ts`). Aclarar en Wave 2 qué campo es “Qué cambia”.
- FU-004: 41 ficheros en `posts/` vs 40 rutas construidas — identificar el
  fichero sin ruta en Wave 1.

### Gate

- [x] Acceptance criteria evidenced (§3 con comandos y resultados reales)
- [x] No unexplained test failures (único FAIL explicado: formato docs)
- [x] No known new regression (cero cambios de producto)
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review
