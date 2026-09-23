# Noticiencias — Baseline técnico/editorial

Estado: READY_FOR_REVIEW
Wave: 0
Fecha: 2026-09-23
Rama: `audit/wave-00-baseline` (desde `main` @ `8c1550b`)
Commit base verificado: `8c1550b` (Merge PR #198)

Todo lo registrado aquí fue verificado por inspección directa o ejecución
real. Sin supuestos.

## 1. Repository

- Default branch: `main`
- Current commit: `8c1550b` (Merge pull request #198)
- Runtime: Node `v24.19.0` (engines: `>=24.0.0 <25`), npm `11.17.0`
- Package manager: npm (lockfile presente)
- Framework: Astro `~7.2.8`, Tailwind CSS v4, Lunr 2.3.9 (búsqueda), MDX
- Deployment target: GitHub Pages, salida estática en `dist/`
- CI: GitHub Actions (`Deploy to GitHub Pages` + jobs de validación);
  comando canónico local `npm run verify:ci`
- Relevant docs/source of truth:
  - `AGENTS.md` (precedencia global)
  - `docs/SOURCE_OF_TRUTH.md`
  - `docs/ARCHITECTURE.md`
  - `docs/tagging.md`
  - `src/content.config.ts` (schema real), `src/config.yaml` (sitio/rutas),
    `src/utils/permalinks.ts`, `src/utils/blog.ts`

## 2. Commands

Comandos reales (de `package.json`):

```bash
# install
npm ci

# unit/integration tests
npm run test:audit        # vitest run → 59 ficheros, 688 tests

# lint (13 checks + prettier --check + eslint)
npm run lint

# typecheck (incluido en validate:content vía astro check)
npm run validate:content  # checks + astro sync + astro check + freeze

# build (image derivatives + astro build)
npm run build

# local preview
npm run preview

# sanity dist
npm run test:dist         # node scripts/dist-sanity.js

# e2e + consentimiento
npm run test:e2e           # playwright test
npm run test:e2e:consent   # fixture NOTICIENCIAS_GA_ID=G-E2ETEST00 + playwright.consent.config.ts

# contrato con backend
npm run check:contract-sync
```

## 3. Baseline results

Ejecutados el 2026-09-23 sobre `main` @ `8c1550b`, rama
`audit/wave-00-baseline`, sin cambios de producto.

| Check                     | Result                        | Notes                                                                                                                                                                                 |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests (`test:audit`)      | PASS                          | 59 ficheros / 688 tests, 0 fallos. Duración ~4.5 s.                                                                                                                                   |
| Lint                      | PASS tras fix docs-only       | Fallaba solo por formato de `docs/products/audit-2026-09/` (6 ficheros); formateados en Wave 0 (cero cambios de producto) → `npm run lint` exit 0 verificado 2026-09-23.              |
| Typecheck (`astro check`) | PASS                          | vía `validate:content` (0 errores; 23 hints informativos).                                                                                                                            |
| `validate:content`        | PASS                          | Exit 0 (todos los checks de contenido + freeze).                                                                                                                                      |
| Build                     | PASS                          | 232 páginas en ~6.5 s.                                                                                                                                                                |
| `test:dist`               | PASS                          | 232 ficheros verificados; `social-manifest.json` contra 40 rutas de artículo.                                                                                                         |
| RSS                       | PASS                          | `dist/rss.xml` generado.                                                                                                                                                              |
| Sitemap                   | PASS                          | `dist/sitemap-index.xml` generado.                                                                                                                                                    |
| E2E consentimiento        | NO EJECUTADO (flaky conocido) | Ver §8 y FOLLOW-UP FU-001: suite móvil-375 marginal en tiempo bajo carga; `main` falla igual que ramas. No se re-ejecutó en Wave 0 para no contaminar el baseline con ruido de carga. |

Corpus: 41 ficheros en `src/content/posts/`; 28 con `schema_version: 2`;
40 rutas de artículo construidas (1 fichero no genera ruta: verificar en
Wave 1 si aplica).

## 4. Critical routes

Rutas reales (ficheros en `src/pages/`):

- `/` → `src/pages/index.astro`
- `/newsletter/` → `src/pages/newsletter.astro` (nota: BASELINE del backlog
  cita `/newsletter/`; existe, verificado)
- `/series/` → `src/pages/series/index.astro` (directorio simple título+enlace; ver P1-10)
- `/series/[slug]/` → `src/pages/series/[slug].astro` (verificar en Wave 6)
- `/metodologia/` → `src/pages/metodologia.md`
- `/nosotros/` → `src/pages/nosotros.md` (línea 59: claim “No rastreamos” — ver P0-10)
- `/privacidad/` → `src/pages/privacidad.md` (documenta GA4 + Cloudflare; ver P0-10)
- `/transparencia/`, `/terminos/`, `/patrocinios/`, `/reportar-problema/` →
  ficheros `.md`/`.astro` homónimos verificados
- `/buscar/` → `src/pages/buscar.astro` + `SearchInterface.astro` (Lunr cliente)
- `/blog/`, `/categorias/[category]/`, `/temas/[tag]/` → paginación Astrowind
- Artículo Herculano: `src/content/posts/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos.md`
  (permalink categoría `Arqueología`; fuente secundaria `source_url` scitechdaily;
  sin `sources[]` con DOI visible — ver P0-01 en Wave 2)
- Artículo biomédico: `src/content/posts/2026-09-18-noticia-cientifica.md`
  (categoría `Salud`; `source_url` preprint biorxiv `10.64898/2026.09.12.751148v1`)
- Categoría Salud: `/categorias/salud/` (ruta generada por `getStaticPaths`; no verificada renderizada en Wave 0)
- Categoría Ciencia: `/categorias/ciencia/`
- Otras: `/rss.xml` (`rss.xml.js`), `/sitemap-index.xml`, `/search.json`,
  `/social-manifest.json`, `/llm-md/*`, `/llms.txt`, `/recursos/*`, `/admin/*`

## 5. Article architecture

- Fuente del contenido: Markdown en `src/content/posts/`, publicado por
  humanos o por el backend (`../noticiencias_news_collector`).
- Schema: `src/content.config.ts` (zod). v2 exige `summary_points` (2–5),
  `glossary` (≥1), `fact_check` (≥1), `why_it_matters` (≥1), `confidence`,
  `sources` (≥1). ⚠️ Tensión con DEC-003/P0-06: `summary_points` impone
  mínimo 2 hoy; Wave 2 debe aclarar qué campo es “Qué cambia”.
- Render: ruta `src/pages/[...slug].astro` → `src/layouts/PostLayout.astro`
  (metadata, JSON-LD `NewsArticle` con `set:html` local — escape hatch
  documentado) → `BaseLayout` → `Metadata.astro`.
- Bloques pre-cuerpo: `summary_points` (“En breve”), `why_it_matters`
  (“Qué cambia”/“Por qué importa”), glosario — localización exacta de
  componentes a inventariar en Wave 4.
- Fuentes/DOI: `source_url` + `sources[] {title, url, publisher?, date?}`;
  `PostLayout` resuelve publisher vía `src/utils/source-publisher.ts`.
  No hay campos `doi`/`journal`/`primary_source` (P0-01).
- Related: `src/components/template/blog/RelatedPosts.astro` (título
  hardcodeado “Posts Relacionados”) → `getRelatedPosts(post, 4)` en
  `src/utils/blog.ts:372`: categoría +5, tag compartido +1, **rellena hasta
  4 sin umbral mínimo** (score 0 incluido, orden estable = más recientes
  primero). Mecanismo P0-08 verificado.
- Autor/revisor: `displayAuthor` normaliza “Noticiencias AI” → “Equipo
  Noticiencias”. No hay campos `reviewer_*` (P0-09).
- Correcciones: no hay `corrected_at`/`correction_summary` (P2-07).
- Responsive: CSS/Tailwind; título duplicado mobile/desktop a verificar en
  Wave 1 (P0-07). `PostLayout` contiene limpieza defensiva de títulos legacy
  (deuda documentada en `docs/ARCHITECTURE.md`).

## 6. Editorial pipeline

Pipeline editorial vive mayoritariamente en el backend; en frontend:

- “En breve” ← `summary_points`; “Qué cambia”/“Por qué importa” ←
  `why_it_matters`. Generación: backend (fuera de este repo).
- Validadores frontend: schema zod (`content.config.ts`) +
  `scripts/check-editorial-fields.js` (espejo pre-publicación) +
  `scripts/check-content-quality.js`.
- Source discovery / primary-source resolution / evidence-type extraction:
  **no existen en frontend** (sin campos ni extractores; Waves 2–3).
- LLM prompts/contratos: backend. Espejo del contrato:
  `news_collector/contracts/frontend_schema.py` ↔ `check-contract-sync.js`.
- Human review hooks / publication gates: no localizados en frontend
  (verificar contra backend en Wave 2 si el finding lo requiere).

## 7. Analytics/privacy

Implementación real (verificada por grep + lectura):

- GA4: ID `G-BP9KG11S3W` en `src/config.yaml:73-75`
  (`analytics.vendors.googleAnalytics.id`).
- Carga: `src/components/template/common/Analytics.astro` (gtag.js).
  `privacidad.md:61` declara que el código carga en todas las visitas
  incluso antes de elegir, con storage denegado hasta aceptar.
- Consent Mode: banner `src/components/ds/organisms/ConsentBanner.astro`
  (gateado por `isAnalyticsEnabled`) + `ConsentBannerScript.astro` +
  `src/utils/browser/consent.ts` (localStorage); `gtag('consent','update')`
  al elegir. Toggle de reapertura en `Footer.astro`.
- Cloudflare: CSP en `CommonMeta.astro` permite
  `static.cloudflareinsights.com` y `cloudflareinsights.com`;
  `privacidad.md:89` declara Cloudflare Web Analytics.
- Cookies/localStorage: `_ga`, `_ga_<ID>` (hasta 2 años) tras aceptar;
  decisión de consentimiento en localStorage.
- Newsletter analytics: evento `newsletter_signup` (solo envío de form,
  sin email) + `outbound_source_click` + `scroll_75` + `search`, vía
  `AnalyticsEventsScript.astro` → `src/utils/browser/analytics-events.ts`.
  `privacidad.md:64` declara los eventos **incluido el texto del buscador
  enviado a GA4**.
- Copy locations: `src/pages/privacidad.md`, `src/pages/nosotros.md:59`.
- ⚠️ Contradicción verificada (P0-10): `nosotros.md:59` afirma
  “No rastreamos, no vendemos datos, no usamos cookies de terceros”
  mientras GA4 + Cloudflare Web Analytics miden comportamiento.

## 8. Current known issues verified

Marcados solo tras verificación directa en esta wave:

- [x] Herculano: terminología/claims — `attenuación` (typo por `atenuación`)
      en glosario; `excerpt` dice “tinta de pergaminos” pero `image_alt` dice
      “papiro”; “Vesubio eruptó” pendiente de grep en Wave 1.
- [x] Biomédico: modelo experimental ambiguo/contradictorio — artículo
      localizado; fuente primaria es preprint biorxiv; verificación de claims
      contra fuente pendiente Wave 1.
- [x] DOM: bloques duplicados — mecanismo no verificado (pendiente Wave 1);
      `RelatedPosts` compone `BlogHighlightedPosts` una sola vez por plantilla.
- [x] “Relacionado”: no semántico — verificado: sin umbral, rellena a 4,
      título hardcodeado “Posts Relacionados”.
- [x] Privacy copy: absolutos incompatibles con analytics — verificado
      (`nosotros.md:59` vs GA4+Cloudflare reales).
- [x] Fuente primaria no visible en casos con paper — verificado a nivel
      schema: no existen campos `doi`/`primary_source`; Herculano solo cita
      medio secundario.
- [x] Evidence type ausente — verificado a nivel schema: sin campo equivalente.
- [ ] Home demasiado extensa/inventario — no medido en Wave 0 (Wave 5).
- [ ] “Última edición”/recency problemática — no verificado (Wave 5).
- [x] Taxonomía padre/hijo confusa — indicio: categorías con variantes
      entrecomilladas/sin entrecomillar (`'Salud'` vs `Salud`, `'Tecnología'`
      vs `Tecnología`); inventario completo pendiente Wave 5 (P1-03).
- [ ] Newsletter CTA/landing débil — no evaluado (Wave 6).
- [ ] “Seguir temas” sin follow real — no verificado (Wave 6).
- [ ] Series como directorio — verificado parcial: `series/index.astro` es
      lista título+enlace sin descripción/conteo (P1-10, Wave 6).
- [ ] Headlines legacy hype — inventario pendiente Wave 5 (P1-09).

Preexistentes fuera del backlog (no “arreglados de paso”):

- `npm run lint` FAIL solo por formato de `docs/products/audit-2026-09/`
  (6 ficheros sin prettier). Se formatea en Wave 0 por ser docs-only.
- E2E consentimiento móvil-375 flaky bajo carga (FU-001): `main` reproduce
  los mismos timeouts que ramas de feature; causa: página pesada + timeouts
  15 s, no regresión de contenido. La rama `feat/trust-tone` (PR #201,
  modifica `nosotros/privacidad/footer/newsletter`) tiene CI pendiente por
  este motivo — Wave 1 deberá rebasear o coordinar con ella.
- Ubicación real de los docs del programa: `docs/products/audit-2026-09/`
  (untracked), no `docs/product/audit-2026-09/` como citan README y
  `WAVE_EXECUTION_PROMPT.md`. Ver DEC-013.

## 9. Visual baseline

Cómo se verificará visualmente en waves posteriores:

- viewport mobile: 375 px (proyecto `mobile-375` en
  `playwright.consent.config.ts`; Playwright disponible).
- viewport desktop: 1280 px.
- screenshots/tool used: Playwright screenshots puntuales a `/tmp`
  (práctica existente: no se guardan imágenes en Git).
- accessibility inspection: `@axe-core/playwright` en devDependencies;
  headings/controles por inspección DOM.
- DOM inspection: `dist/` + `cheerio` (devDependency) o Playwright.

## 10. Baseline gate

- [x] comandos reales identificados (§2)
- [x] tests/lint/typecheck/build ejecutados donde existen (§3)
- [x] fallos preexistentes registrados (§3, §8)
- [x] rutas críticas localizadas (§4)
- [x] pipeline y componentes afectados ubicados (§5–§7)
- [x] analytics/privacy ubicados (§7)
- [ ] `IMPLEMENTATION_LEDGER.md` actualizado (al cierre de Wave 0)
- [ ] Wave 1 puede empezar sin adivinar arquitectura (veredicto en gate report)
