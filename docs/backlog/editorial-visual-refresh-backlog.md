# Editorial Visual Refresh — Continuation Backlog

> Status: Open
> Created: 2026-05-17
> Source of truth: `docs/EDITORIAL_VOICE.md` (sections 3 archetypes + 4 D1-D8)
> Pairs with backend: `noticiencias_news_collector/` (cross-repo items flagged below)

## How to use this backlog

This document is **self-contained**: a cold session should be able to pick up any item without re-reading the conversation that produced it. Before starting any item, read these three things in order, then jump to the item:

1. `docs/EDITORIAL_VOICE.md` — the editorial doctrine all visual decisions defer to.
2. `AGENTS.md` — binding engineering laws. Especially LAW-F2 (layer boundaries) and the "no client framework islands" rule.
3. The "Files to touch" and "Acceptance criteria" of the chosen item below.

What's already done (so don't redo it):

- D1 — `#` literal removed from tag chips (commit `df12b5b`).
- D2 — `<TagPill />` unifies `ArticleCard` and `Tags.astro` (commit `df12b5b`).
- D3 — Home copy refreshed with hook; passes the AI-magazine ban guard (commit `df12b5b`).
- D4 — `sources[]` / `source_url` visible via `<TrustPanel>` in `PostLayout.astro`; the duplicate prose footer is gone (commits `f754059` + backend `6a32965`).
- D8 (partial) — `ds/atoms/Button.astro` fixed (phantom `action-primary` token), `404.astro` + `beta.astro` migrated, deprecation comment on legacy `.btn` in `global.css` (commit `df12b5b`).
- QW-1..QW-5 (from `noticiencias-ui-improvements-plan.md`, verified done on 2026-08-02): alt text con `check-image-alt.js` sin fallback silencioso; `getFormattedDate` con variantes `compact|long|relative` en `src/utils/date.ts` (sin `toLocaleDateString` en componentes); `check-slug-quality.js` en cadena lint (0 posts `article-NNN`); `NewsletterCapture` sin formulario cuando `form.endpoint` está vacío; `getTopicFrequency` filtra `count >= 2`, ordena desc y topa en 6 con `[]` si nada califica.

## High priority

### D6 — Investigation archetype visual differentiation ✅

**Resolved: June 2026.** All visual differentiation is implemented:

- `src/components/ds/atoms/InvestigationBadge.astro` — atom with Indigo accent, microscope icon
- `src/components/ds/organisms/ArticleCard.astro:122` — renders badge when `post.investigation`
- `src/layouts/PostLayout.astro:124` — renders badge in article header
- `ArticleCard.astro:137` — `font-serif` for investigation lead cards
- `PostLayout.astro:140` — `font-serif` for investigation article titles
- `src/utils/hub.ts:24-25,34-35` — `selectFeaturedPosts` prefers investigation as tiebreaker and in fallback
- `tests/hub.test.ts` — 2 unit tests for investigation preference in featured selection

### D7 — "Qué cambia" archetype visual treatment ✅

**Resolved: June 2026.** The consequence archetype has full visual differentiation:

- `src/components/ds/organisms/ArticleCard.astro` — `variant="consequence"` branch with distinct styling (border, bg, shadow), uses `why_it_matters[0]` as lead headline, and renders ámbito kicker from `post.category?.title` (option a: inferred from categories)
- `src/components/common/DailyDesk.astro:97-111` — renders `contextPosts` with `variant="consequence"` in a 3-column grid under "Qué cambia" heading
- `src/utils/hub.ts:48-51` — `selectContextPosts` prefers posts with `why_it_matters[]` populated

### D5 — uncertainty_note visual emphasis tied to `requires_uncertainty_note`

Problem: The backend `headline` agent now emits `requires_uncertainty_note: boolean` (commit `noticiencias_news_collector@6a32965`) but the value is not currently transported to the frontend frontmatter, and `<TrustPanel>` shows `uncertainty_note` at uniform weight regardless. The intent (per `EDITORIAL_VOICE.md` D5 and section 2.4 rule 3) is that when a curiosity-gap headline rides on a preliminary finding, the uncertainty must be visually prominent — not just present.
Impact: The contract between hook strength and uncertainty visibility — the core of "rigor en el método, curiosidad en la entrada" — is not enforced visually. Long-term trust risk if hooks promise more than the body's uncertainty acknowledges.
Recommendation: Two coordinated changes.

1. Backend (cross-repo): persist `requires_uncertainty_note` into the published frontmatter (current pipeline emits it from `_generate_headlines` but `process_article` does not copy it into `model_dict`). See `news_collector/components/editorial/ai_editor.py` around line 1474 onwards; add the field to `model_dict` and update the `AstroPost` contract / `frontend_schema.py` to allow it. Coordinate with `src/content.config.ts` LAW-F1 (schema-sealed change).
2. Frontend: read `post.requires_uncertainty_note` (will need to be added to `src/content.config.ts` as `z.boolean().default(false)`, and propagated through `src/utils/blog.ts` Post type) and pass it to `<TrustPanel>`. The panel renders the `uncertaintyNote` block at a higher prominence (callout style, accent border, possibly an "Importante" pre-label) when the flag is true.

Affected repo(s): frontend + backend (cross-repo schema change).
Suggested priority: high (but blocked until next backend pipeline run produces articles with the new field — the backend code is already in place from `6a32965`).

Files to touch:

- Backend: `news_collector/components/editorial/ai_editor.py` (model_dict assembly ~line 1474), `news_collector/contracts/frontend_schema.py` (add the field).
- Frontend: `src/content.config.ts` (add `requires_uncertainty_note: z.boolean().default(false)` to the posts schema), `src/utils/blog.ts` (propagate to normalized `Post`), `src/types.d.ts` (add to Post type if it exists there), `src/components/common/TrustPanel.astro` (accept new prop, render emphasized variant), `src/layouts/PostLayout.astro:184-191` (pass new prop).

Acceptance criteria:

- A test article with `requires_uncertainty_note: true` renders the `uncertaintyNote` with visibly higher emphasis than a normal article (border-l-4 in `primary` color, larger label, etc.).
- Existing articles (without the field) render unchanged (default `false`).
- `npm run check:contract-sync` passes against the updated backend schema.
- `npm run lint && npm run build && npx vitest run` all green.

Risk: Medium. Cross-repo schema change governed by AGENTS.md LAW-F1. Coordinate the contract update before shipping the frontend reader.

## Medium priority

### D8 follow-up — Migrate Astrowind widget Button consumers to `ds/atoms/Button.astro`

Problem: `src/components/template/ui/Button.astro` still wraps the legacy `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-tertiary` classes from `src/styles/global.css`. Several Astrowind-derived widgets in `src/components/template/widgets/` (Header, CallToAction, Features, Hero, etc.) consume this wrapper. Until those callsites migrate, the legacy classes cannot be deleted from `global.css`.
Impact: Two button languages coexist in the codebase — rounded-full pills (legacy) and rounded-md editorial buttons (DS). The visual inconsistency is the same kind of fragmentation D1/D2 fixed for tags.
Recommendation: Migrate the widget callsites one at a time, then delete `template/ui/Button.astro` and the legacy `.btn` block from `global.css`. Each widget migration is independent and low-risk; bundle by widget if a single PR is preferred.
Affected repo(s): frontend.
Suggested priority: medium (purely visual consistency; no functional bug).

Files to touch (in suggested order):

1. `src/components/template/widgets/Header.astro:163-172` — the actions array currently feeds into `template/ui/Button.astro` with `btn-primary` override. Replace with `ds/atoms/Button.astro` mapping `variant="primary"`.
2. `src/components/template/widgets/CallToAction.astro`, `Hero.astro`, `Hero2.astro`, `Features.astro`, `Features2.astro`, `Steps.astro` — search for `import Button from` pointing to the template wrapper and migrate.
3. Once no callsites remain, delete `src/components/template/ui/Button.astro` and remove the `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-tertiary` block from `src/styles/global.css:37-62`.

Acceptance criteria:

- `grep -rn "template/ui/Button" src/` returns no results.
- `grep -rn "class=\"btn" src/` returns no results.
- Visual smoke test on `/`, `/blog/`, `/buscar/`, `/beta/` — buttons render with `rounded-md` editorial style.
- `npm run lint && npm run build && npx vitest run` all green.

Risk: Low per widget; medium in aggregate because Header is high-visibility.

### Stop tracking `.astro/` runtime cache in git

Problem: `.gitignore` does not list `.astro/`. The dev server and `astro sync` mutate `.astro/data-store.json` and `.astro/content-assets.mjs` on every run, producing dirty working trees and auto-commits like `19aae64` (the placeholder-message commit that appeared on top of `f754059` in this session's history).
Impact: Noisy diffs, accidental commits with meaningless messages, and a "modified" state that masks real work-in-progress. The cache is regenerated automatically by Astro on next sync; tracking it in git provides zero value.
Recommendation: Add `.astro/` to `.gitignore`. Remove tracked cache files from the index in the same commit (`git rm --cached -r .astro/`). Verify with `npm run dev` then `npm run build` that nothing depends on the tracked cache.
Affected repo(s): frontend.
Suggested priority: medium.

Files to touch:

- `.gitignore` — add `.astro/` line.
- Run `git rm --cached -r .astro/` to untrack the existing files.

Acceptance criteria:

- After `npm run dev` + `npm run build`, `git status` shows clean working tree (no `.astro/` entries).
- `npm run lint && npm run build && npx vitest run` all green.

Risk: Very low. Astro regenerates the cache on demand.

## Migrated from `noticiencias-ui-improvements-plan.md` (May 2026 plan, triaged 2026-08-02)

The following items come from the root-level UX plan (`noticiencias-ui-improvements-plan.md`, audit of 24 May 2026). The quick wins QW-1..QW-5 were verified as done on 2026-08-02 and are NOT listed here. Items below are the remaining priority improvements, ordered as recommended by the plan (PR-3 → PR-1 → PR-2 → PR-5 → PR-4).

### PR-3 — Alinear la promesa de cadencia con la realidad

Problem: La descripción de la portada (`src/pages/index.astro:28`) todavía promete "La edición diaria de ciencia y tecnología...", pero no se publica a diario. El eyebrow de `DailyDesk.astro:21` usa `new Date()` ("Portada · fecha de hoy") en vez de la frescura real del contenido, y el h1 dice "La ciencia que conviene seguir hoy." Mientras tanto, el boletín y el newsletter dicen "semanal" (`NewsletterCapture.astro`). Conviven tres promesas distintas.
Impact: La promesa de cadencia es inconsistente (diaria vs. semanal) y el eyebrow miente sobre la frescura: muestra la fecha actual aunque la pieza más reciente tenga días. Es el mismo tipo de "site feels off" que el plan buscaba eliminar.
Recommendation: Adoptar la opción B del plan (cadencia semanal). Cambiar la descripción de `index.astro` a "selección semanal", agregar `getEditionDate(posts)` en `src/utils/hub.ts` (devuelve el `publishDate` más reciente), pasar ese valor a `DailyDesk` como prop y usar la fecha de la pieza más reciente en el eyebrow en lugar de `new Date()`; revisar el copy del h1 ("hoy" → "esta semana" o similar).
Affected repo(s): frontend.
Suggested priority: medium (solo copy + datos; despeja expectativas antes del trabajo visual mayor).
Files to touch:

- `src/pages/index.astro` (meta description)
- `src/components/common/DailyDesk.astro` (eyebrow, h1 y prop de fecha de edición)
- `src/utils/hub.ts` (nueva función `getEditionDate`)
- `src/config.yaml` (meta description, opcional)

Acceptance criteria:

- `grep -rn "edición diaria" src/` no devuelve resultados.
- El eyebrow de la portada refleja la fecha de la pieza más reciente, no `new Date()`.
- La descripción de metadata y el titular coinciden en cadencia.
- `npm run lint && npm run validate:content` verdes.

Risk: Bajo (copy y datos; sin cambio de layout).

### PR-1 — Fuente primaria arriba del pliegue

Problem: La página de artículo muestra un byline "Por <autor>" (`PostLayout.astro:149-153`) pero la fuente primaria solo aparece en el `TrustPanel`, al final del cuerpo; las tarjetas no muestran el publicador en absoluto. El schema tiene `source_url` (`src/content.config.ts:30`) pero no un nombre de publicador legible.
Impact: Se pierde la atribución visible ("¿de dónde sale esto?") en el punto de mayor decisión de lectura; el lector debe llegar al final del artículo para ver la fuente. Es el contrapeso de confianza que el sitio promete en su meta y en su metodología.
Recommendation: Opción A del plan: mostrar "Fuente: <publicador>" sobre el pliegue (en tarjeta y en el header del artículo) con nota de traducción, dejando la lista completa con enlaces en el `TrustPanel`. Agregar `source_publisher: z.string().optional()` al schema de contenido con derivación por defecto desde `source_url` (mapa `hostnameToPublisher`), crear `src/components/ds/molecules/SourceLine.astro` y montarlo en `ArticleCard` (todos los variantes salvo `consequence`) y en el header de `PostLayout`. Para posts con autor "Noticiencias AI", reemplazar el byline redundante por la línea de fuente.
Affected repo(s): frontend (campo de schema aditivo y opcional; el backend ya publica `source_url`).
Suggested priority: medium (componente contenido, alto impacto en confianza). Hacer antes de PR-2 y PR-4.
Files to touch:

- `src/content.config.ts` (campo aditivo `source_publisher`)
- `src/utils/blog.ts` y tipo `Post` (propagación del campo)
- Nuevo `src/components/ds/molecules/SourceLine.astro`
- `src/components/ds/organisms/ArticleCard.astro` (meta row)
- `src/layouts/PostLayout.astro` (header del artículo; byline condicional)

Acceptance criteria:

- Toda tarjeta de portada muestra una línea de publicador.
- La página de artículo muestra "Fuente: <publicador> · traducción NotiAI" sobre el lede.
- `TrustPanel` conserva la lista completa de fuentes con enlaces (no se quita).
- `npm run lint && npm run validate:content && npm run build` verdes; `npm run check:contract-sync` sigue pasando (campo aditivo).

Risk: Medio — cambio en schema sellado (LAW-F1), aunque aditivo y opcional. No requiere coordinación con el backend si el campo solo se deriva en frontend.

### PR-2 — Separar visualmente categorías de tags (mapa de colores explícito)

Problem: `TopicBadge.astro` asigna colores con una cascada de `lower.includes()` (9 ocurrencias, líneas 19-54) con fallback genérico para slugs desconocidos, y `src/utils/categorySections.ts` no tiene mapa de colores. La separación estructural ya está hecha: `ArticleCard` muestra `TopicBadge` (categoría) en la fila de meta y `TagPill` en una fila aparte, y `PostLayout` saca los tags al final del cuerpo vía `TopicStrip` ("Seguir temas").
Impact: Los colores dependen de subcadenas del título (colisiones entre categorías con palabras compartidas, p. ej. "física" y "ciencia"), el fallback genérico es indistinguible de un color intencional y no existe un mapa canónico por slug de categoría.
Recommendation: Reemplazar la cascada por un mapa cerrado de colores por slug de categoría (las 9 categorías del plan: ciencia, astronomia, salud, tecnologia, editorial, fisica, quimica, biologia, arqueologia), definir el mapa en `src/utils/categorySections.ts` y hacer que un slug desconocido no renderice nada (assert en build) en lugar del fallback genérico. Mantener `TagPill` como tratamiento exclusivo de tags.
Affected repo(s): frontend.
Suggested priority: medium. Hacer después de PR-1 para no tocar dos veces la meta row de las tarjetas.
Files to touch:

- `src/components/ds/atoms/TopicBadge.astro` (lookup por slug en vez de cascada; revisar firma: hoy recibe `topic` como string de título)
- `src/utils/categorySections.ts` (mapa de colores por slug)
- Callsites de `TopicBadge` (pasar slug además de título si la firma cambia)
- Tests si aplica

Acceptance criteria:

- `grep -rn "lower.includes" src/components/ds/atoms/` no devuelve resultados.
- `TopicBadge` resuelve el color desde el mapa por slug de categoría; slug desconocido → no renderiza nada.
- La fila de meta de `ArticleCard` muestra solo `TopicBadge`; los tags nunca comparten fila (ya verificado).
- `npm run lint && npm run validate:content && npm run build` verdes.

Risk: Bajo-medio (cambio visual en tarjetas y header; verificar los 9 slugs contra las categorías reales de los posts).

### PR-5 — Diálogo de búsqueda en el header con ⌘K / `/`

Problem: No existe ningún disparador de búsqueda en el header; `SearchInterface.astro` es la página completa `/buscar/` (h1 "Buscador" + form + resultados) y arranca Lunr al cargar la página (~600 ms hasta el primer input utilizable). El único acceso es el enlace "Buscar en el archivo" del pie de la portada (`DailyDesk.astro:167-174`).
Impact: La búsqueda está a dos clics, exige abandonar la página y tarda; el atajo universal ⌘K/" /" no existe.
Recommendation: Crear un diálogo modal con `<dialog>` nativo (`src/components/common/HeaderSearch.astro`), disparado desde el header con botón y atajos `/` (fuera de inputs) y ⌘K/Ctrl-K; arranque diferido del índice de Lunr al primer foco (extraer el boot de `SearchInterface.astro` a un módulo compartido `src/utils/browser/search-index.ts` con `loadIndex()` + `search()`); estado por defecto con los 5 posts más recientes; navegación con ↑/↓, Enter y ESC; enlace "Ver todos los resultados →" a `/buscar/?q=<query>`. Mantener `/buscar/` como página (SEO y fallback sin-JS). Respetar LAW-F3: HTML estático + script scoped, sin isla de framework.
Affected repo(s): frontend.
Suggested priority: medium. Independiente de los demás PR.
Files to touch:

- Nuevo `src/components/common/HeaderSearch.astro` (dialog + trigger)
- `src/components/template/widgets/Header.astro` (montar el trigger; hoy no tiene ningún control de búsqueda) y su configuración de acciones en `src/config.yaml` si aplica
- Nuevo `src/utils/browser/search-index.ts` (extracción del boot de Lunr)
- `src/components/common/SearchInterface.astro` (usar el módulo compartido; de paso elimina los warnings de eslint de variables sin usar)
- `src/pages/buscar.astro` (se mantiene tal cual)

Acceptance criteria:

- El botón del header abre el diálogo en la página; no navega a `/buscar/`.
- `/` (fuera de inputs) y ⌘K/Ctrl-K abren el diálogo; ESC lo cierra.
- `/buscar/` sigue funcionando como página (fallback sin-JS + SEO).
- Tiempo al primer input utilizable < 100 ms (vs ~600 ms actuales).
- ↑/↓ mueven el resaltado, Enter navega, "Ver todos los resultados →" enlaza a `/buscar/?q=<query>`.
- `npm run lint && npm run validate:content && npm run build && npm run test:audit` verdes.
- Verificación manual 375px/1280px sin errores de consola (AGENTS.md §7).

Risk: Medio (LAW-F3: sin isla; el arranque debe ser idempotente entre transiciones de página — reutilizar el patrón `astro:page-load` que ya usa `SearchInterface`).

### PR-4 — Rail de contexto sticky en desktop

Problem: El cuerpo del artículo es una sola columna (`max-w-3xl`, `PostLayout.astro:177`) donde se apilan hasta seis paneles (En breve, Qué cambia, prosa, Glosario breve, TrustPanel, TopicStrip, RelatedReading); no hay navegación de contexto visible durante el scroll y el ancho de desktop queda subutilizado.
Impact: La lectura larga pierde el ancla contextual (resumen, glosario, fuentes) en cuanto se avanza; el patrón "sigo el hilo" que el diseño editorial quiere no existe en desktop.
Recommendation: Grid de dos columnas en `lg:` (`grid-cols-[1fr_280px]`) con rail `position: sticky; top: 80px` que componga "En breve", "Glosario" y "Fuentes" (`ArticleRail.astro` en `ds/molecules`); mover "Qué cambia" arriba del cuerpo como prólogo editorial; en móvil (<1024px) los mismos componentes se intercalan inline, sin rail. Dividir `TrustPanel` (resumen para el rail, lista completa al final del cuerpo). Es la tarea de mayor alcance del plan; hacerla después de PR-1 y PR-2.
Affected repo(s): frontend.
Suggested priority: low (mayor alcance).
Files to touch:

- Nuevo `src/components/ds/molecules/ArticleRail.astro`
- `src/layouts/PostLayout.astro` (grid + orden de secciones)
- `src/components/common/TrustPanel.astro` (división rail/fondo)
- `src/components/ds/molecules/KeyTakeaways.astro` (evaluar si se pliega al rail)

Acceptance criteria:

- Desktop (≥1024px): rail sticky con En breve / Glosario / Fuentes visible durante el scroll; el cuerpo ya no ocupa todo el ancho de la columna.
- Móvil (<1024px): sin rail; el mismo contenido aparece inline en las posiciones actuales.
- Los paneles apilados en el cuerpo pasan de ~6 a 2 (Qué cambia + prosa, más TrustPanel al final).
- El orden del rail respeta el outline del documento para lectores de pantalla (sin `aria-hidden`).
- `npm run lint && npm run validate:content && npm run build && npm run test:audit` verdes; verificación manual 375px/1280px.

Risk: Medio (restructuración del layout más visible del sitio; respetar LAW-F2: `PostLayout` no debe adquirir lógica de contenido).

## Low priority

### Replace MD5 in `ai_editor.py` cache keys with SHA-256

Problem: `noticiencias_news_collector/news_collector/components/editorial/ai_editor.py:1341` uses MD5 to generate cache filenames for the staged article artifacts. Codacy flags this as an insecure hash algorithm. (Pre-existing — not introduced by recent edits.)
Impact: Practically none. The hash here is used only as a deterministic filename component for local cache; it is not a cryptographic signature. The lint flag is correct in principle but the actual risk is negligible.
Recommendation: Replace `hashlib.md5(...)` with `hashlib.sha256(...)[:16]` (truncated to a similar length) so the linter stops flagging and we are not having to explain the false positive on every PR. Verify cache invalidation behavior is preserved.
Affected repo(s): backend.
Suggested priority: low (lint hygiene, not security).

Files to touch:

- `noticiencias_news_collector/news_collector/components/editorial/ai_editor.py:1341` (and any other MD5 call in the file — `grep -n hashlib.md5` to find all).

Acceptance criteria:

- `grep -n hashlib.md5 news_collector/components/editorial/ai_editor.py` returns no results.
- Existing tests in `tests/` (backend) pass.
- A fresh `process_article` run produces the same article body it would have produced before (cache key change forces a one-time re-derivation, which is expected).

Risk: Low. One-time cache invalidation is the only side effect.

### Clarify `quick-wins-regression.test.ts` dist-stale check execution order

Problem: The `uses a fresh dist build for dist-backed assertions` test in `tests/quick-wins-regression.test.ts:51-53` fails whenever `src/` is newer than `dist/`. It is intended as a CI sentinel ("you forgot to build") but it runs as part of `npm run test:audit`, which a developer would naturally run before deciding to build. The result is a test that fails locally on every change to any source file.
Impact: Confusing local DX. The signal "your tests failed" arrives on every working-tree change, not just on legitimate regressions, so the failure gets ignored.
Recommendation: Two options. (a) Move the freshness check into `npm run test:dist` (which already exists and is dist-specific), removing it from `npm run test:audit`. (b) Make the test conditional on the existence of dist artifacts that the rest of the file already needs, so it only runs when those exist. Option (a) is cleaner.
Affected repo(s): frontend.
Suggested priority: low (DX, not correctness).

Files to touch:

- `tests/quick-wins-regression.test.ts` — split the "uses a fresh dist build" `it()` block out into a `tests/dist-freshness.test.ts` that is only included by `npm run test:dist` (via vitest config or filename pattern), or guard it with an `if (!fs.existsSync(distDir)) return;` early-return that converts the assertion into a no-op when dist is absent.

Acceptance criteria:

- `npm run test:audit` does not fail purely because dist is stale.
- `npm run test:dist` (or its successor) catches the same regression.
- All existing real assertions in `quick-wins-regression.test.ts` continue to run as part of `test:audit`.

Risk: Very low.

## Cross-repo dependencies summary

For convenience when planning a multi-PR sprint:

| Item                                   | Frontend-only | Backend-only | Both |
| -------------------------------------- | :-----------: | :----------: | :--: |
| D6 — Investigation visual              |       ✓       |      ✓       |  ✅  |
| D7 — Qué cambia visual                 |       ✓       |      ✓       |  ✅  |
| D5 — uncertainty emphasis              |               |              |  ✓   |
| D8 follow-up — Widget Button migration |       ✓       |              |      |
| `.astro/` untrack                      |       ✓       |              |      |
| MD5 → SHA-256                          |               |      ✓       |      |
| dist-stale test fix                    |       ✓       |              |      |
| PR-3 — Cadence copy                    |       ✓       |              |      |
| PR-1 — Source line                     |       ✓       |              |      |
| PR-2 — Category color map              |       ✓       |              |      |
| PR-5 — Header search dialog            |       ✓       |              |      |
| PR-4 — Sticky article rail             |       ✓       |              |      |

## Related persistent memory

If using Claude/Agent SDK with the `auto memory` system, the following memory entries already document the strategic context and should be consulted before starting any item:

- `feedback-editorial-voice` — voice direction (curioso/riguroso, línea roja).
- `editorial-voice-doc` — pointer to `docs/EDITORIAL_VOICE.md` as canonical.
- `backend-prompts-pipeline` — backend prompt locations + headline_critic mechanism.
- `promise-revisit-2026-06-17` — calendar reminder to revisit the Editorial Promise.

These live under the project's `memory/` directory in the Claude harness; they are not part of either git repo.
