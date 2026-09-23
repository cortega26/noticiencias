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

| Wave | Nombre                       | Estado | Rama                         | Gate                             | Notas                                                                                      |
| ---- | ---------------------------- | -----: | ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| 0    | Baseline y guardrails        | REVIEW | audit/wave-00-baseline       | —                                | Docs-only; sin cambios de producto                                                         |
| 1    | Correctness & Trust Hotfixes | REVIEW | audit/wave-01-trust-hotfixes | —                                | 5/5 findings en REVIEW; validación integral PASS                                           | Ver reporte Wave 1 abajo  |
| 2    | Editorial Data Contract      |   DONE | —                            | 6a50da8 + backend feb4768 (#324) | CI verde tras merge ordenado (backend→frontend)                                            |
| 3    | Evidence & Accountability UX |   DONE | —                            | d0d8168 + backend #325           | CI verde tras merge ordenado; Codex sin comentarios (cuota); Codacy 0                      |
| 4    | Article UX                   |   DONE | —                            | b0be5d5                          | CI verde (incl. Codacy tras fix walkDist); PRs #199/#200/#201 cerrados en la misma ventana | Ver reporte Wave 4 arriba |
| 5    | Home, Recency & IA           |   DONE | —                            | 195cb3c (#210)                   | 4/4 findings mergeados; validación integral PASS; Codacy 0 tras fix bf8f43c                | Ver reporte Wave 5 arriba |
| 6    | Conversion & Collections     |   DONE | —                            | 63c6b56 (#212)                   | 4/4 findings mergeados; validación integral PASS; Codacy 0 tras fix c101596                | Ver reporte Wave 6 arriba |
| 7    | Discovery & Retention        |   DONE | —                            | f90dd8a (#214)                   | 3/3 findings mergeados; validación integral PASS; Codacy 0 tras fix f84cf94                | Ver reporte Wave 7 arriba |
| 8    | Measurement                  |   DONE | —                            | 1a7c428 (#216)                   | 2/2 findings mergeados; validación integral PASS; Codacy 0 tras fix 22b9447                | Programa inicial cerrado  |

## Findings

| ID    | Wave | Estado | Depends on  | Commit  | Tests/Validation                                                                                                                 | Notas                                                                             |
| ----- | ---: | ------ | ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P0-04 |    1 | REVIEW | —           | bb3e860 | lint + validate:content PASS; fuente scitechdaily verificada (PLOS ONE DOI 10.1371/journal.pone.0353485 guardado para Wave 2)    | papiro/pergamino, attenuación, eruptó; Epicuro se conserva fiel a fuente citada   |
| P0-05 |    1 | REVIEW | —           | 2b45508 | lint + validate:content PASS; claims contra preprint bioRxiv (PDF métodos/discusión)                                             | huésped NOD SCID declarado; nota ya no pide validación animal; KC n=2 descriptivo |
| P0-07 |    1 | REVIEW | —           | c987aa8 | lint PASS; build PASS; dist verificado (h1×1, sin h2 Fuentes, TrustPanel×1); `tests/article-sources-single.test.ts` 2/2 PASS     | rail ya no renderiza `sources`; par rail/sidebar aceptado (DEC-015)               |
| P0-08 |    1 | REVIEW | —           | 67db3e2 | lint PASS; verificación DOM en build final de wave                                                                               | “Sigue leyendo”; RelatedPosts.astro muerto se deja (nota)                         |
| P0-10 |    1 | REVIEW | —           | aed783b | lint pendiente verificacion final; copy contrastado con Analytics.astro/consent/CSP                                              | fix mínimo (DEC-014); #201 rebasea; su rewrite de privacidad fuera de scope       |
| P0-01 |    2 | REVIEW | —           | 41de936 | schema 38/38 + lint + validate + build + dist (primaria+DOI+Cobertura; legacy intacto); contract-sync PARITY OK; backend PR #324 | backfill verificado 2 artículos; sin invención                                    |
| P0-02 |    2 | REVIEW | —           | 41de936 | schema enum 8 valores + unknown; dist (modelo+guardrail Salud; legacy sin línea); backend PR #324                                | experimental añadido (DEC-016); Salud no-humana con guardrail fuerte              |
| P0-06 |    2 | REVIEW | —           | 7ae5133 | cardinalidades 0-3 en schema; corpus máx 3; render ya condicional                                                                | espejo max_length=3 en backend PR #324                                            |
| P0-03 |    3 | REVIEW | —           | be3f248 | schema + TrustPanel (publicación/institución); dist verificado                                                                   | sin placeholders; institución omitida si multi-afiliación                         |
| P0-09 |    3 | REVIEW | —           | be3f248 | IA solo en piezas AI; sin reviewer (no inventado); fallback institucional                                                        | ningún post declara reviewer (sin dato verificado)                                |
| P2-02 |    3 | REVIEW | P0-06       | be3f248 | bloques omisibles; backfill 3+2/3+3 desde fuentes                                                                                | sin especulación; legacy sin bloques                                              |
| P2-07 |    3 | REVIEW | —           | be3f248 | par viaja junto (schema+espejo); nota visible fechada; legacy sin caja                                                           | sin correcciones pendientes en corpus                                             |
| P1-05 |    4 | REVIEW | P0-06       | 8bff3af | Lo esencial ≤3 + Qué cambia (DEC-018); dist+visual                                                                               | pre-body consolidado sin perder info                                              |
| P1-04 |    4 | REVIEW | P0-01,P0-02 | 8bff3af | chips ≤3 vía TopicBadge; dist+visual 375/1280                                                                                    | sin dashboard; legacy sin chips                                                   |
| P1-01 |    5 | REVIEW | P1-04,P1-05 | c144bf9 | lint+validate+build+dist+test:audit (738/739; contract-sync ambiental FU-012); DOM home: 9 promovidas antes de secundario        | portada reordenada; rails de categoría fuera; ~35→12 cards                        |
| P1-02 |    5 | REVIEW | P1-01       | c144bf9 | DOM: sin «Última edición»; «Esta semana» solo con ventana real; fallback «Lo más reciente»                                       | fechas de edición visibles y honestas                                             |
| P1-03 |    5 | REVIEW | —           | 02f2e9c | nav 6 entradas; hijos de Ciencia anidados; 9/9 categorías en sitemap; URLs intactas                                              | footer mantiene las 9 secciones                                                   |
| P1-09 |    5 | REVIEW | —           | ce0e8d6 | `HEADLINE_INVENTORY.md` (40 títulos); 0 hype en portada; sin cambios de URL/título                                               | inventario entregado; sin sustitución ciega                                       |
| P1-06 |    6 | REVIEW | P1-01       | 5500742 | lint+validate+build+dist+test:audit (745/746; contract-sync ambiental FU-012); e2e estados PASS (2 proyectos)                    | captura inline; CSP connect-src buttondown                                        |
| P1-07 |    6 | REVIEW | P1-06       | 563379c | axe /newsletter/ PASS; DOM: qué incluye + FAQ + historias representativas                                                        | landing de conversión                                                             |
| P1-08 |    6 | REVIEW | —           | 1ed9d11 | grep: 0 «Seguir temas»/«En seguimiento» en src                                                                                   | labels de navegación honestos                                                     |
| P1-10 |    6 | REVIEW | —           | 4e8037e | unit series 5/5 + dist dossier 3/3; 3 URLs en sitemap; título sin duplicar                                                       | dossiers editoriales                                                              |
| P2-01 |    7 | REVIEW | P0-08       | fcde137 | unit related 6/6 + dist 3/3; umbral 2; fallback «Más reciente» verificado                                                        | ranking semántico; cadena muerta eliminada                                        |
| P2-06 |    7 | REVIEW | P1-03       | d9611e8 | unit+dist hub; 3 hubs curados; tags singleton sin bloques; axe /temas/coral/ PASS                                                | masa crítica >=2; noindex intacto                                                 |
| P2-05 |    7 | REVIEW | P1-08,P2-06 | f4ec04f | 157 feeds por tema; dist follow PASS; unfollow explícito                                                                         | RSS temático sin cuenta                                                           |
| P2-03 |    8 | REVIEW | P1-06,P2-01 | 1748bd1 | unit+dist+e2e (analytics 6/6, consent 22/22); 11 eventos en el bundle; nombres viejos fuera                                      | embudo GA4 sin PII                                                                |
| P2-04 |    8 | REVIEW | P2-03       | 7b4ca4d | docs/EDITORIAL_METRICS.md con 8 KPIs (definición/fórmula/evento/límites)                                                         | entregable documental                                                             |

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

## Wave 1 — Correctness & Trust Hotfixes

Date: 2026-09-23
Branch: audit/wave-01-trust-hotfixes (base: main @ b52be8e)
Status: REVIEW

### Findings

- P0-04 — REVIEW — bb3e860
- P0-05 — REVIEW — 2b45508
- P0-07 — REVIEW — c987aa8
- P0-08 — REVIEW — 67db3e2
- P0-10 — REVIEW — aed783b

### Validation

- unit: `npm run test:audit` → 60 ficheros / 690 tests PASS (incl. nuevo `article-sources-single` 2/2)
- integration: `npm run validate:content` → exit 0 (schema, editorial fields, freeze, astro check)
- lint: `npm run lint` → exit 0 (verificado tras cada finding)
- typecheck: PASS vía `astro check`
- build: `npm run build` → exit 0, 232 páginas
- visual: cambios de solo texto/contenido; sin cambios de layout. DOM verificado en `dist/` (ver evidencias). Sin screenshots dédiés: no hay alteración visual estructural.
- SEO/SSR: `npm run test:dist` → 232 ficheros PASS; sin cambios de URL/títulos/metadata; RSS/sitemap regenerados en build.
- other: e2e consentimiento no ejecutado (FU-001 vigente; sin cambios en banner/analytics en esta wave).

Evidencias DOM en `dist/` (post-build):

- Herculano: `pergamino` ×0; `Sigue leyendo` ×1; h2 `Relacionado` ×0; `Posts Relacionados` ×0; h1 ×1; h2 `Fuentes` desnudo ×0; `Fuentes y verificación` ×1.
- Biomédico: `NOD SCID` presente (huésped declarado en HTML).
- Nosotros: `No rastreamos` ×0; nuevo copy de medición agregada presente.

### Regressions checked

- Revisión adversarial por finding: legacy sin `sources` (TrustPanel retorna null; rail sin secciones vacías), fallback `summary_points`→`excerpt` intacto, sin cambios de URL/canonical/RSS/sitemap, sin JS nuevo, sin cambios de consentimiento/analytics.
- Riesgo residual: `RelatedPosts.astro` (template, sin consumidores) conserva el título viejo — muerto en la ruta de render; se deja intacto a propósito (nota en commit 67db3e2).

### Decisions added

- DEC-014 (P0-10 mínimo sobre main; #201 rebasea)
- DEC-015 (par rail/sidebar aceptado como patrón responsive)

### Follow-ups

- FU-001 vigente (flaky consent móvil-375).
- FU-002 parcial: #201 debe rebasear sobre Wave 1 al mergear (conflicto esperado: línea de privacidad en `nosotros.md` + rewrite de `privacidad.md` a revisar según DEC-014).
- FU-003 vigente (tensión DEC-003 vs `summary_points` mín. 2 → Wave 2).
- FU-004 vigente (41 ficheros vs 40 rutas → Wave 1 no lo resolvió; mover a Wave 2 preflight o tratar como FU de Wave 5/taxonomía).
- FU-005 (nuevo): verificar en Wave 2 que `why_it_matters` items con forzado regional (Herculano líneas 53–54) se rigen por P0-06.
- FU-006 (nuevo): `TopicStrip` en artículo titula `Seguir temas` sin follow real → P1-08 Wave 6.
- FU-007 (nuevo): fuente primaria PLOS ONE Herculano (DOI 10.1371/journal.pone.0353485) localizada y verificada → insumo P0-01 Wave 2. Igual el DOI bioRxiv del biomédico (10.64898/2026.09.12.751148) para `sources[]`.
- FU-008 (nuevo): Epicuro vs Filodemo en Herculano se conserva fiel a la fuente secundaria citada; corregir exige fuente primaria (PLOS ONE) → Wave 2 con P0-01.

### Gate

- [x] Acceptance criteria evidenced (evidencias DOM + tests arriba)
- [x] No unexplained test failures (690/690; lint/build/validate/dist PASS)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 2 — Editorial Data Contract

Date: 2026-09-23
Branch: audit/wave-02-editorial-contract (base: main @ 93c3bef)
Status: REVIEW

### Findings

- P0-06 — REVIEW — 7ae5133
- P0-01 — REVIEW — 41de936 (+ adversarial a6f75fc)
- P0-02 — REVIEW — 41de936 (+ adversarial a6f75fc)

P0-01 y P0-02 comparten commit por archivos entrelazados (DEC-016);
atomicidad preservada en ledger.

### Validation

- unit: `npm run test:audit` → 61 ficheros / 715 tests PASS (schema 39/39:
  cardinalidades 0–3, rol/doi, enum 8 valores, doi-exige-primario)
- integration: `npm run validate:content` → exit 0 (corpus: máx 3
  why_it_matters; 28 v2 OK)
- lint: `npm run lint` → exit 0 (tras cada cambio)
- typecheck: PASS vía `astro check`
- build: exit 0, 232 páginas
- visual: sin cambios de layout; DOM verificado en `dist/`
- SEO/SSR: `test:dist` 232 PASS; sin cambios URL/títulos/metadata; RSS intacto
- contract: `check:contract-sync --strict` PARITY OK (1 divergencia tolerada
  preexistente); backend `make test-contracts` 164 PASS + nuevo test espejo
- other: e2e consent no ejecutado (FU-001; wave sin cambios banner/analytics)

Evidencias DOM en `dist/`:

- Herculano: Fuente primaria (PLOS ONE + DOI texto) + Cobertura
  (SciTechDaily); modelo `experimento de laboratorio`; sin guardrail Salud.
- Biomédico: Fuente primaria (bioRxiv + enlace DOI), sin Cobertura
  inventada; modelo `fases mixtas` + guardrail `Evidencia mixta`.
- Legacy (tortuga): `Fuentes` plano, sin `Fuente primaria`, sin línea de modelo.

### Regressions checked

Adversarial ejecutado con 2 hallazgos corregidos en a6f75fc:

1. DOI en secundaria quedaba invisible → schema exige `role: primary`
   con DOI (espejo Pydantic simétrico).
2. Guardrail `mixed` afirmaba ausencia total en humanos → texto
   diferenciado para mixto.

Resto: legacy sin `sources`/`evidence` rinde igual que antes; `hasContent`
incluye evidencia (sin paneles vacíos); sin JS nuevo; sin cambios de
consentimiento/analytics/URLs.

### Decisions added

- DEC-016 (`experimental` + lecciones del checker + commit combinado)

### Follow-ups

- FU-001 vigente (flaky consent).
- Backend PR #324 (`contract/wave2-editorial-mirror`) pendiente de merge:
  espejo + spec + tests + PIPELINE_CONTRACTS. Mergear antes o junto con
  esta wave para no dejar paridad rota en main (si #324 tarda, el hook
  `check:contract-sync` falla en main tras mergear frontend).
- FU-003 resuelto (why_it_matters 0–3 implementado ambos lados).
- FU-005 pendiente → P0-06 hecho en contrato; reescritura de items con
  forzado regional queda a criterio editorial futuro (no inventado aquí).
- FU-007 resuelto (DOIs verificados usados como backfill).
- FU-008 vigente (Epicuro → Wave 2 no lo tocó; P0-01 registra la fuente
  primaria para que Wave 3+ la use).
- FU-009 (nuevo): `RelatedPosts.astro` muerto sigue con título viejo;
  eliminar o alinear cuando P2-01 (Wave 7) traiga ranking real.
- FU-010 (nuevo): `check-editorial-fields.js` no valida los campos nuevos
  (role/doi/evidence) — el schema zod + tests cubren; considerar espejo si
  el gate pre-publicación lo exige.

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (715/715 + paridad + 164 backend)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 3 — Evidence & Accountability UX

Date: 2026-09-23
Branch: audit/wave-03-evidence-accountability (base: main @ 6a50da8)
Status: REVIEW

### Findings

- P0-03 — REVIEW — be3f248
- P0-09 — REVIEW — be3f248
- P2-02 — REVIEW — be3f248
- P2-07 — REVIEW — be3f248

Un commit por wave (archivos entrelazados, DEC-017); atomicidad en ledger.

### Validation

- unit: `npm run test:audit` → 61 ficheros / 727 tests PASS con espejo
  vigente (51 schema incl. 12 Wave 3); sin espejo vigente el
  `contract-sync.test.ts` falla por checkout hermano desactualizado
  (ambiental, no regresión — CI usa main del backend)
- integration: `npm run validate:content` → exit 0
- lint: `npm run lint` → exit 0
- typecheck: PASS vía `astro check` (1 error real corregido:
  `publicationLabels` faltante)
- build: exit 0, 232 páginas
- visual: sin cambios de layout; DOM verificado en `dist/`
- SEO/SSR: `test:dist` 232 PASS; sin cambios URL/títulos/metadata
- contract: paridad OK contra espejo (backend PR #325); backend
  `test-contracts` PASS + ruff/black OK
- other: e2e consent no ejecutado (FU-001; sin cambios en esa área)

Evidencias DOM en `dist/`:

- Biomédico: Publicación/preprint/McGill; IA + Equipo Noticiencias;
  Qué sabemos ×3 / Qué no sabemos ×3; sin Corrección.
- Herculano: revisada por pares; Qué sabemos ×3 / ×2; IA; sin guardrail
  Salud; sin Corrección.
- Legacy: sin línea de modelo, sin sabidos/pendientes, sin caja de
  corrección, sin línea de accountability (pieza no-AI sin reviewer).

### Regressions checked

- Legacy rinde igual (condicionales en todo bloque nuevo).
- `hasContent` extendido (sin paneles vacíos).
- Sin identidad humana fabricada (ningún `reviewer_name` en corpus).
- Sin JS nuevo; sin cambios consentimiento/analytics/URLs/RSS.
- Worktree backend de benchmark intacto (edición stray revertida;
  proceso vivo verificado).

### Decisions added

- DEC-017 (TrustPanel superficie única)

### Follow-ups

- Backend PR #325 pendiente de merge: mergear antes o junto con la PR
  frontend (mismo protocolo que Wave 2).
- FU-001 vigente; FU-004 vigente (41 vs 40); FU-006 (Seguir temas → W6);
  FU-008 (Epicuro → requiere primaria, ahora registrada);
  FU-009 (RelatedPosts muerto → W7); FU-010 (check-editorial-fields no
  valida campos nuevos — schema+tests cubren).
- FU-011 (nuevo): worktree backend `spec/llm-routing-benchmark` quedó en
  base anterior a #324 (stale); al terminar el benchmark, rebasear antes
  de cualquier trabajo con contratos.
- FU-012 (nuevo): `contract-sync.test.ts` local depende del checkout
  hermano; con backends desactualizados falla ambientalmente. CI es la
  referencia (usa main del backend).

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (727/727 con espejo; fallo local
      ambiental documentado)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 4 — Article UX

Date: 2026-09-24
Branch: audit/wave-04-article-ux (base: main @ d0d8168)
Status: REVIEW

### Findings

- P1-05 — REVIEW — pendiente commit
- P1-04 — REVIEW — pendiente commit

### Validation

- unit: `npm run test:audit` → 62 ficheros / 731 tests PASS con espejo
  vigente (nuevo `article-header-wave4` 4/4)
- integration: `npm run validate:content` → exit 0
- lint: `npm run lint` → exit 0
- typecheck: PASS vía `astro check`
- build: exit 0, 232 páginas
- visual: screenshots 375 + 1280 del artículo biomédico, 0 errores de
  consola; chips en fila compacta (desktop) y wrap limpio (móvil)
- SEO/SSR: `test:dist` 232 PASS; sin cambios URL/títulos/metadata
- contract: sin cambios de schema (N/A)
- other: e2e consent no ejecutado (FU-001; sin cambios en esa área)

Evidencias DOM en `dist/`:

- Biomédico: chips [Modelo: fases mixtas, Preprint, Fuente primaria];
  Lo esencial ×1 bloque; Qué cambia ×1; En breve/En la práctica ×0.
- Herculano (5 summary_points): cada bloque Lo esencial visible con
  exactamente 3 bullets.
- Legacy: sin fila de chips; bloques renombrados igual (componente
  compartido).

### Regressions checked

- `quick-wins-regression` detectó «Por qué importa» baneado → renombrado
  a «Qué cambia» (DEC-018), guardarraíl intacto y verde.
- Labels compartidos en `src/utils/evidence-labels.ts` (segundo uso
  concreto; TrustPanel importa del mismo mapa, sin duplicar).
- `metodologia.md` actualizado (docs siguen a código).
- Legacy sin datos: sin chips, sin bloques vacíos.
- Sin JS nuevo; sin cambios consentimiento/analytics/URLs/RSS.

### Decisions added

- DEC-018 («Qué cambia» vs guardarraíl de voz)

### Follow-ups

- FU-001 vigente; FU-004 vigente; FU-006 (→W6); FU-008 (→primaria
  registrada); FU-009 (→W7); FU-010; FU-011 (stale branch backend);
  FU-012 (test local ambiental).
- Sin espejo backend en esta wave (sin cambios de schema).

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (731/731 con espejo vigente de main;
      el fallo local de contract-sync-test es ambiental por checkout hermano
      desactualizado, FU-012; el de voz se resolvió con DEC-018)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 5 — Home, Recency & Information Architecture

Date: 2026-09-23
Branch: audit/wave-05-home-recency-ia (base: main @ 065910a)
Status: DONE (squash 195cb3c, PR #210)

### Findings

- P1-01 — REVIEW — c144bf9 (+ fix Codacy bf8f43c)
- P1-02 — REVIEW — c144bf9
- P1-03 — REVIEW — 02f2e9c (+ fix Codacy bf8f43c)
- P1-09 — REVIEW — ce0e8d6

### Validation

- unit: `npm run test:audit` → 62 ficheros / 738 de 739 PASS; el único
  fallo es `contract-sync.test.ts` ambiental (checkout backend en
  `spec/llm-routing-benchmark`, previo a #324/#325 — FU-012)
- integration: `npm run validate:content` → exit 0 (astro check 0 errores)
- lint: `npm run lint` → exit 0
- typecheck: PASS vía `astro check` (1 error de test corregido:
  narrowing `'links' in link`)
- build: exit 0, 232 páginas
- visual: screenshots full-page 375 y 1280 de `/`; axe-core
  (`homepage has no a11y violations`) PASS en mobile-375 y desktop-1280;
  consola sin errores (solo aviso preexistente de `autocomplete` en el
  input del boletín — FU-013)
- SEO/SSR: `npm run test:dist` → 232 ficheros PASS; sitemap sin `/temas/`;
  9/9 categorías presentes; RSS intacto; canonical intacto
- contract: sin cambios de schema (N/A)
- other: e2e consentimiento no ejecutado (FU-001; sin cambios en esa área)

Evidencias DOM en `dist/`:

- Home: hero 3 + «Lo más reciente» 6 = 9 historias promovidas antes de
  contenido secundario; «Serie destacada» (0 historias) y «Del archivo» 3
  después; 12 `article` en total (antes ~35 con los rails de 9 categorías).
- Home: no existe «Última edición»; «Esta semana» solo se usa si la
  ventana de 7 días tiene historias; en el corpus actual (ventana agotada
  por el hero) el bloque cae honestamente a «Lo más reciente».
- Home: 1 solo formulario de boletín y 1 solo `id="newsletter-email"`
  (el CTA temprano es un enlace a `/newsletter/`).
- Header: 6 entradas (Ciencia, Astronomía, Salud, Tecnología, Editorial,
  Más); Ciencia anida «Toda la sección, Física, Química, Biología»; Más
  anida «Arqueología, Series»; footer conserva las 9 secciones.
- Portada P1-09: ningún titular clasificado `hype` es promovido; el único
  marcado expuesto es el de chatbots (`factual issue`, no hype) en
  «Del archivo» (ver `HEADLINE_INVENTORY.md`).

### Regressions checked

- Legacy: secciones y bloques nuevos son condicionales (sin datos no
  renderizan); posts sin serie, sin tags, sin imagen siguen funcionando.
- Duplicados: hero excluye «Lo más reciente» y este excluye «Del
  archivo»; no hay tarjetas repetidas en la portada.
- URLs/canonical/RSS/sitemap: sin cambios de rutas; 232 páginas; tag
  pages siguen fuera del sitemap.
- Voz: guardarraíl `quick-wins-regression` verde (el fallback se probó
  primero con «Seguir leyendo» y colisionó con la lista de frases
  prohibidas; se usó «Lo más reciente», ya validado en DEC-008).
- Código muerto: `selectContextPosts`, `buildCategoryRails` y
  `homeSectionItems` se retiraron junto con sus tests (único consumidor
  era la portada anterior).
- `showInHeader` se sustituyó por `navGroup` (primary/ciencia/mas); el
  footer y las taxonomías no cambian.

### Decisions added

- DEC-019 (portada por bloques y recencia honesta)
- DEC-020 (navegación primaria ≤6 con subdisciplinas anidadas)
- DEC-021 (P1-09: inventario, sin sustitución ciega)

### Follow-ups

- FU-001 vigente (flaky consent).
- FU-004 resuelto: el «fichero 41» de `src/content/posts/` es
  `refinery_manifest.json` (manifiesto, no post); 40 posts → 40 rutas.
- FU-006 (Seguir temas → W6); FU-008 (Epicuro → primaria registrada);
  FU-009 (RelatedPosts muerto → W7); FU-010; FU-011 (branch backend
  stale); FU-012 (contract-sync local ambiental) vigentes.
- FU-013 (nuevo): el input de email de `NewsletterCapture` no declara
  `autocomplete="email"` (aviso de consola preexistente); tocar en P1-06
  (Wave 6).
- FU-014 (nuevo): el corpus no puebla `featured`/`featured_rank`; el hero
  usa el fallback «más recientes». La portada ya soporta curación
  explícita cuando el backend emita los campos.
- FU-015 (nuevo): 16 titulares legacy marcados en
  `HEADLINE_INVENTORY.md` (hype, Title Case, causalidad) quedan para
  reescritura editorial contra fuente; no sustituir a ciegas.

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (738/739; el fallo restante es el
      ambiental FU-012)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 6 — Conversion & Editorial Collections

Date: 2026-09-23
Branch: audit/wave-06-conversion-collections (base: main @ 524d911)
Status: DONE (squash 63c6b56, PR #212)

### Findings

- P1-06 — REVIEW — 5500742
- P1-07 — REVIEW — 563379c
- P1-08 — REVIEW — 1ed9d11
- P1-10 — REVIEW — 4e8037e

### Validation

- unit: `npm run test:audit` → 745 de 746 PASS; único fallo
  `contract-sync.test.ts` ambiental (FU-012). Nuevos: `series.test.ts`
  5/5, `series-dossier.test.ts` 3/3.
- e2e: `npx playwright test tests/playwright/newsletter.test.ts
tests/playwright/accessibility.test.ts` → 16/16 PASS en mobile-375 y
  desktop-1280 (estados del boletín con Buttondown mockeado + axe).
- integration: `npm run validate:content` → exit 0 (astro check 0 errores)
- lint: `npm run lint` → exit 0
- build: exit 0, 232 páginas
- visual: screenshots 375/1280 de home (CTA inline), landing y dossier
  `/series/salud-que-importa/`; sin errores de consola nuevos
- SEO/SSR: `npm run test:dist` → 232 ficheros PASS; sitemap con las 3
  series; tags siguen fuera; títulos de serie ya no duplican
  «| Noticiencias»
- contract: sin cambios de schema (N/A)
- other: e2e consentimiento no ejecutado (FU-001; sin cambios en esa área)

Evidencias DOM en `dist/`:

- Home: 2 formularios de boletín con ids únicos
  (`newsletter-hero-email`, `newsletter-final-email`), `autocomplete`,
  `role=status` y botón con hook; CTA temprano inline.
- CSP (meta + `_headers` + doc): `connect-src` incluye
  `https://buttondown.com`; `form-action` intacto.
- /newsletter/: «Qué incluye cada edición» (4), «Historias
  representativas» (3 posts reales) y FAQ (5) antes del pie.
- /series/espacio/: descripción, «8 artículos · Actualizada el …»,
  «Empieza aquí» y partes 1–8 en orden cronológico.
- Labels: 0 ocurrencias de «Seguir temas»/«En seguimiento» en `src/`.

### Regressions checked

- No-JS: el formulario conserva `method=post` y `action` de Buttondown
  (custodiado por `quick-wins-regression`).
- JS: estados con `role=status`; fallo de red → error + botón
  rehabilitado; éxito → botón deshabilitado (sin doble envío).
- CSP: `tests/compliance.test.ts` mantiene las tres copias idénticas.
- Series: posts sin serie no generan dossier; corpus vacío cae al
  mensaje «Próximamente»; URLs `/series/[slug]/` sin cambios.
- Se elimina `Newsletter.astro` (wrapper muerto, sin consumidores) y
  `selectFeaturedSeries`/`FeaturedSeries` de `hub.ts` (sin duplicar
  lógica: la usa `buildSeriesDossiers`).

### Decisions added

- DEC-022 (mejora progresiva del boletín + CSP connect-src)
- DEC-023 (descripciones de serie en mapa frontend hasta el contrato)

### Follow-ups

- FU-001, FU-009, FU-010, FU-011, FU-012, FU-014, FU-015 vigentes.
- FU-006 resuelto (labels honestos en toda la navegación de temas).
- FU-013 resuelto (`autocomplete="email"` en la captura).
- FU-016 (nuevo): llevar `series_description` (y metadatos de serie) al
  contrato de publicación para retirar el mapa de `src/utils/series.ts`.
- FU-017 (nuevo): el operador debe actualizar la Response Header
  Transform Rule del edge (Cloudflare) con el `connect-src` que ahora
  incluye `https://buttondown.com`; las tres copias del repo ya están
  sincronizadas.
- FU-018 (nuevo): P2-03 (Wave 8) debe añadir un evento de resultado del
  boletín; hoy solo existe `newsletter_signup` en el submit.

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (745/746; fallo ambiental FU-012)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 7 — Discovery & Retention

Date: 2026-09-23
Branch: audit/wave-07-discovery-retention (base: main @ 51ed592)
Status: DONE (squash f90dd8a, PR #214)

### Findings

- P2-01 — REVIEW — fcde137
- P2-06 — REVIEW — d9611e8
- P2-05 — REVIEW — f4ec04f

### Validation

- unit: `npm run test:audit` → 759 de 760 PASS; único fallo
  `contract-sync.test.ts` ambiental (FU-012). Nuevos: `related.test.ts`
  6/6, `related-dist.test.ts` 3/3, `topic-hub.test.ts` 3/3,
  `topic-follow.test.ts` 2/2.
- e2e: `npx playwright test tests/playwright/accessibility.test.ts` →
  14/14 PASS en mobile-375 y desktop-1280 (incluye `/temas/coral/`).
- integration: `npm run validate:content` → exit 0 (astro check 0 errores)
- lint: `npm run lint` → exit 0
- build: exit 0, 232 páginas + 157 feeds de tema + `/rss.xml`
- visual: screenshots 1280 de `/temas/coral/` (hub enriquecido) y del
  bloque «Más reciente» en `/editorial/2026-02-12-bienvenidos/`
- SEO/SSR: `npm run test:dist` → 232 ficheros PASS; tags siguen fuera
  del sitemap y con `robots: index:false`
- contract: sin cambios de schema (N/A)
- other: e2e consentimiento no ejecutado (FU-001; sin cambios en esa área)

Evidencias DOM en `dist/`:

- Herculano: bloque «Relacionado» con los 2 pares de Arqueología
  (Arpones, Herramientas), sin relleno por recencia.
- Bienvenidos: bloque «Más reciente» (0 señales sobre el umbral); no
  aparece «Relacionado» ni «Posts Relacionados» en artículos.
- `/temas/coral/`: descripción, «2 historias · Actualizada el 20 de
  septiembre de 2026», áreas (Biología, Ciencia) y bloque «Seguir este
  tema» con `/temas/coral/rss.xml`.
- `/temas/materia-oscura/`: encabezado simple («1 historia publicada
  sobre este hilo»), sin descripción inventada.
- Feed de tema: `Noticiencias — coral` con solo las 2 historias del tag.

### Regressions checked

- Cadena muerta eliminada (RelatedPosts → BlogHighlightedPosts →
  Grid/GridItem); `check:freeze` pasa (la congelación solo bloquea
  modificaciones, no borrados de ficheros muertos).
- `rankRelatedPosts` no muta `allPosts`; el fallback excluye el propio
  post y se ordena por fecha.
- El feed por tema reutiliza `buildFeed` (segundo consumidor concreto);
  `/rss.xml` intacto.
- Contenido: se retiró el tag «misión» de Bienvenidos (colisión de
  sentidos); el resto de tags y URLs sin cambios.
- Sin JS nuevo; sin cambios de consentimiento/analytics/URLs de posts.

### Decisions added

- DEC-024 (related con umbral y fallback explícito)
- DEC-025 (hubs temáticos curados, masa crítica y noindex)
- DEC-026 (seguimiento real por RSS temático)

### Follow-ups

- FU-001, FU-010, FU-011, FU-012, FU-014, FU-015, FU-016, FU-017,
  FU-018 vigentes.
- FU-009 resuelto (cadena de related muerta eliminada).
- FU-019 (nuevo): la colisión del tag «misión» debe resolverse en la
  taxonomía backend (`tags.yml`/pipeline); hoy se corrigió el frontmatter
  y una republicación podría reintroducirla.
- FU-020 (nuevo): señales de entidades/fenómeno requieren extracción en
  backend; el ranking actual usa solo metadatos estructurados.
- FU-021 (nuevo): descripciones de tema viven en `src/utils/topics.ts`
  hasta que el contrato transporte metadatos de tema; los hubs nuevos
  exigen curación explícita.

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (759/760; fallo ambiental FU-012)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Wave 8 — Measurement

Date: 2026-09-23
Branch: audit/wave-08-measurement (base: main @ d8a34dd)
Status: DONE (squash 1a7c428, PR #216)

### Findings

- P2-03 — REVIEW — 1748bd1
- P2-04 — REVIEW — 7b4ca4d

### Validation

- unit: `npm run test:audit` → 764 de 765 PASS; único fallo
  `contract-sync.test.ts` ambiental (FU-012). Nuevos:
  `analytics-wiring.test.ts` 4/4 y `analytics-events.test.ts`
  actualizado (11/11).
- e2e regular: `npx playwright test` → 77 PASS, 1 skip preexistente
  (incluye `analytics.test.ts` 6/6 con dataLayer real: article_view,
  article_50/90, newsletter_impression/start/submit, topic_click,
  related_article_click y primary_source_click).
- e2e consentimiento: `npm run test:e2e:consent` → 22/22 PASS (incluye
  `newsletter_submit` con `form_id` y el nuevo read depth).
- integration: `npm run validate:content` → exit 0 (astro check 0 errores)
- lint: `npm run lint` → exit 0
- build: exit 0, 232 páginas
- visual: sin cambios visuales (solo data attributes y docs)
- SEO/SSR: `npm run test:dist` → 232 ficheros PASS
- contract: sin cambios de schema (N/A)

Evidencias en `dist/` y bundle:

- 11 eventos del embudo presentes en el JS compilado; `newsletter_signup`
  y `scroll_75` ya no existen.
- Artículo: `[data-analytics-article]` ×1, `[data-analytics-primary-source]`
  ×1 (sin `data-analytics-source` en primaria), `[data-analytics-related]`
  con `related_kind`.
- Portada: hooks `data-analytics-topic`/`data-analytics-series` y
  formularios con `data-newsletter-form-id` (hero/final).
- `privacidad.md` declara los eventos nuevos; checklist del operador
  actualizado (evento clave, dimensiones y smoke test).

### Regressions checked

- La impresión del boletín se mide en scroll (sin IntersectionObserver)
  para no romper el invariante del lifecycle suite (observers lineales);
  verificado 77/77 en la suite regular.
- `article_view` se deduplica por artículo y sesión (no infla la segunda
  lectura); el read depth conserva el «sin chequeo inmediato» para
  artículos cortos.
- Los enlaces primarios ya no disparan `outbound_source_click` (evento
  específico); la cobertura sigue disparándolo.
- Sin JS nuevo de terceros; sin cambios de consentimiento ni de CSP.

### Decisions added

- DEC-027 (contrato de eventos del embudo GA4)
- DEC-028 (KPIs editoriales en `docs/EDITORIAL_METRICS.md`)

### Follow-ups

- FU-001, FU-010, FU-011, FU-012, FU-014, FU-015, FU-016, FU-017,
  FU-019, FU-020, FU-021 vigentes.
- FU-018 resuelto (resultado del boletín: impresión, inicio y envío).
- FU-022 (nuevo): el operador debe crear en GA4 las dimensiones
  personalizadas nuevas (`form_id`, `article_path`, `target_path`,
  `related_kind`, `series_slug`, `topic_slug`) y marcar
  `newsletter_submit` como evento clave (checklist actualizado).
- FU-023 (nuevo): no hay evento de impresión del bloque relacionado; el
  CTR usa `article_view` como denominador proxy.
- FU-024 (nuevo): comparar `newsletter_submit` (intención) con las
  suscripciones confirmadas de Buttondown para la conversión real.

### Gate

- [x] Acceptance criteria evidenced
- [x] No unexplained test failures (764/765; fallo ambiental FU-012)
- [x] No known new regression
- [x] Ledger updated
- [x] Decisions updated
- [x] Ready for human review

## Cierre de deuda técnica — 2026-09-23 (post-programa)

Fuera de wave, se cierran los follow-ups que quedaban abiertos. Rama
`chore/tech-debt-closure`; el backend cierra su único pendiente en PR #326.

### Resueltos con código y evidencia

- **FU-023** (`5a3cf98`): el bloque relacionado emite `related_impression`
  al 50 % de visibilidad; `docs/EDITORIAL_METRICS.md` define el CTR contra
  esa impresión. Verificado en e2e (dataLayer real).
- **FU-010** (`2eb441a`): `check-editorial-fields.js` valida el contrato v2
  nuevo (role/doi, evidencia, institución/estado, reviewer, sabidos/
  preguntas, correcciones, incertidumbre) con `--repoRoot` y 8 tests.
- **FU-001 + flake `target-size`** (`0fb20b3`): `checkA11y` mide solo tras
  `load` + fuentes + altura estable y vuelve arriba. Evidencia: a11y 8/8
  bajo carga (14/14 cada uno) y consentimiento 3/3 bajo carga (22/22).
  `docs/backlog/a11y-target-size-flake.md` queda resuelto.
- **FU-015** (`a2c91f9`): pasada editorial verificada sobre los 16
  titulares marcados (antes/después en `HEADLINE_INVENTORY.md`); sin
  cambios de URL y con los encabezados duplicados alineados.

### Cerrados por decisión

- **FU-014, FU-016, FU-021** → `docs/adr/0013-editorial-metadata-ownership.md`:
  `featured` es del backend (fallback aceptado); las descripciones de serie
  y tema viven en mapas frontend hasta un modelo de contenido de primera
  clase. Dejan de ser deuda abierta.
- **FU-019** (tag «misión»): el post legacy ya no lo declara y el tag es
  legítimo para misiones espaciales; no hay cambio de taxonomía backend que
  hacer. Cerrado con rationale.
- **FU-024** (lado cliente): `newsletter_success` /
  `newsletter_error` cierran el resultado del envío; la suscripción
  confirmada sigue siendo de Buttondown (operador).
- **FU-017, FU-022 y la verificación post-deploy del plan 009** son acciones
  de operador (Transform Rule del edge, dimensiones GA4, cookies reales).
  Están en `docs/ANALYTICS_OPERATOR_CHECKLIST.md` y
  `docs/DEPLOYMENT_SECURITY_HEADERS.md`; no son deuda de código.
- **Backlogs obsoletos** (`editorial-visual-refresh-backlog.md`,
  `source-of-truth-backlog.md`): cerrados con tabla de resoluciones.
- **Planes 005/006**: triados como roadmap de producto, no deuda
  (`plans/README.md`).

### Backend

- **PR #326** (`9224124`): registra `reports/evaluation/enrichment-pattern-v1.json`,
  baseline reproducible de plan 048 (44 registros, no decisorio; umbral 200).
  El árbol de backend queda limpio.

### Estado final

Ningún follow-up del programa queda abierto como deuda técnica. Lo único
pendiente son las acciones de operador listadas arriba y el roadmap
(planes 005/006, plan 048 a ≥200 registros, revisita del benchmark LLM).
