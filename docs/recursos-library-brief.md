# Recursos library brief — from one page to a hub

> **Status**: Spike brief (direction only, P3). No code changes in this doc.
> **Scope**: Create three evergreen companion guides for `src/pages/recursos/`.
> Out of scope: code changes to pages, layouts, or components.
> **Current state**: `src/pages/recursos/` contains exactly
> `src/pages/recursos/detector-de-hype.md` (frontmatter
> `layout: '~/layouts/template/MarkdownLayout.astro'`, five-question guide
> ending with a newsletter CTA). Homepage section
> `src/components/common/DailyDesk.astro` ("Para leer con criterio") links
> Detector de hype, `src/pages/metodologia.md`, and `src/pages/buscar.astro`.

## Boundary statement

Guides teach "criterio lector" (how to read science news critically). They
never duplicate news reporting, explainers of specific findings, or opinion.

This boundary comes directly from the voice docs:

- Promise (`docs/EDITORIAL_VOICE.md`): "Noticiencias hace que la ciencia que
  importa se sienta tan interesante como realmente es."
- Operating principle (`docs/EDITORIAL_VOICE.md`): "rigor en el método,
  curiosidad en la entrada" — "Quien entra por curiosidad sale informado;
  quien entra escéptico sale convencido."
- What we are not (`docs/EDITORIAL_VOICE.md`): "No somos un portal de hype
  tecnológico", "No somos un boletín académico", "No somos un medio de
  opinión", "No somos un agregador social".
- Style (`docs/EDITORIAL.md`): "Cursiva + Explicación" for anglicisms;
  tone "Informativo, riguroso pero accesible"; voice "Tercera persona,
  neutral"; "Evitar: Sensacionalismo, clickbait engañoso".

Consequences for the library:

- Each guide answers reader questions ("how do I judge this claim?"), not
  news questions ("what happened?").
- No new findings, no literature reviews, no methods tutorials for
  researchers, no generic science blogging.
- If a draft starts explaining a specific paper's result instead of teaching
  a transferable reading skill, it belongs in `src/content/posts/`, not in
  `src/pages/recursos/`.
- New guides reuse the hype-guide shape: `MarkdownLayout.astro` frontmatter,
  question-led sections, plain-Markdown links, closing newsletter CTA to
  `src/pages/newsletter.astro`.
- New guides must also be added to both LLM resource routes
  (`src/pages/llms.txt.ts`, one-line entry mirroring the detector line, +
  `src/pages/llms-full.txt.ts`, full-content section via `readStaticPage`),
  priced as part of each guide build — not as a component change, but the
  `llms-full.txt` regression coverage for the new route must be extended in
  the same PR, or the guides stay undiscoverable to LLM consumers while
  `llms-full.txt` keeps claiming the full corpus.

Link constraint (verified, not assumed):

- `src/components/common/RelatedReading.astro` takes `Post[]` only.
- `src/components/common/TopicStrip.astro` builds tag permalinks only.
- `src/components/ds/molecules/ArticleRail.astro` renders post sections
  (`summary`, `glossary`, `sources`) only.
- None accepts static-page targets today. Guide distribution is therefore
  restricted to link-capable plain-`<a>` surfaces: DailyDesk cards,
  newsletter CTAs, detector cross-links, and metodologia-style Markdown
  links. Anything else must be priced as a component change.

## Ranked shortlist (3 guides)

### Rank 1 — Preprint vs. revisado: qué peso darle a cada versión

- **Working title**: "Preprint o revisado: qué peso darle a cada versión"
- **Why criterio lector**: Directly extends detector question 5 ("¿Ya lo
  revisaron otros científicos?"), the most frequent reader confusion when
  Noticiencias itself cites arXiv/bioRxiv. Teaches a durable triage reflex.
- **Exclusion boundary**: NOT a publishing tutorial (how to post a preprint,
  how peer review works operationally, journal rankings, open-access policy).
  NOT news about any specific preprint.
- **Target length**: Same band as the hype guide (~90–120 lines of Markdown,
  5 questions, ~800–1,200 words).
- **5-section outline** (question-led):
  1. ¿Dónde está publicado esto ahora mismo?
  2. ¿Quién lo ha revisado y quién todavía no?
  3. ¿Qué puede cambiar entre esta versión y la definitiva?
  4. ¿Cómo lo citan otros: lo usan o solo lo mencionan?
  5. ¿Qué hago yo como lector mientras tanto (esperar, compartir con aviso,
     buscar réplica)?
- **Link-capable surfaces**: DailyDesk card; cross-link from detector
  section 5; closing CTA to newsletter; reciprocal link from metodologia
  preprint paragraph. No `RelatedReading` / `TopicStrip` / `ArticleRail`.

### Rank 2 — Cómo leer un paper sin ser especialista

- **Working title**: "Cómo leer un paper sin ser especialista"
- **Why criterio lector**: Gives readers the 15-minute routine behind the
  Noticiencias "Fuentes y verificación" box (abstract → methods → sample →
  limits → DOI trail). Turns opaque trust ("confía en nosotros") into
  checkable skill.
- **Exclusion boundary**: NOT a statistics or methods course (no p-values
  teaching, no study-design taxonomy beyond reader triage, no academic
  writing advice). NOT an explainer of any single finding.
- **Target length**: Same band as the hype guide (~90–120 lines, 5 questions,
  ~800–1,200 words).
- **5-section outline** (question-led):
  1. ¿Qué afirma el resumen y qué recorta?
  2. ¿A quién o qué se estudió (personas, animales, células, simulación)?
  3. ¿Cuántos participaron y durante cuánto tiempo?
  4. ¿Qué dicen los autores que NO saben (límites, conflictos, funding)?
  5. ¿Dónde sigo el rastro (DOI, revista, citas, réplicas)?
- **Link-capable surfaces**: DailyDesk card; cross-link from detector
  questions 1–2–4; closing CTA to newsletter; link from metodologia "ficha
  de fuentes" paragraph. No `RelatedReading` / `TopicStrip` / `ArticleRail`.

### Rank 3 — Rastrear una fuente hasta el origen (DOI, citas, réplicas)

- **Working title**: "Del titular al DOI: rastrear una fuente hasta el origen"
- **Why criterio lector**: Operationalizes the metodologia promise ("Dejar el
  rastro", "Volvemos hacia la fuente original") as a reader habit: find the
  DOI, open the original, check corrections/retractions. Smallest conceptual
  overlap with ranks 1–2.
- **Exclusion boundary**: NOT a citation-style manual (no APA/Vancouver
  rules, no reference-manager tutorials, no academic-integrity policing).
  NOT a fact-check of any live claim.
- **Target length**: Shorter band (~60–90 lines, 5 questions, ~600–900 words).
- **5-section outline** (question-led):
  1. ¿El artículo enlaza la fuente original o solo la menciona?
  2. ¿Hay DOI y a dónde lleva?
  3. ¿Es la versión citada la versión vigente (correcciones, retractaciones)?
  4. ¿Quién más cita este trabajo y para decir qué?
  5. ¿Cuándo basta el resumen y cuándo hay que abrir el PDF?
- **Link-capable surfaces**: DailyDesk card (or rotated fourth slot);
  cross-links from detector "Qué hacemos en Noticiencias" list and rank-2
  guide section 5; closing CTA to newsletter. No `RelatedReading` /
  `TopicStrip` / `ArticleRail`.

## Ownership + freshness cadence

- **Owner**: Equipo Editorial (single human approver per guide, same bar as
  `src/pages/metodologia.md`).
- **Cadence**: Review each guide every 12 months plus on-trigger review when
  `src/pages/metodologia.md` changes its sourcing/verification claims or
  when detector cross-links change.
- **Change rule**: Guides are evergreen reference, not news. Edits fix
  examples, links (DOI/arXiv/bioRxiv flows), and wording only. Any scope
  expansion (new sections, new guides) needs a new brief, not a drive-by
  edit — this contains scope creep into generic science blogging.

## Validation gates

Post-oriented checks are NOT guide gates:

- `scripts/check-frontmatter-dates.js` walks `src/content/posts/` only.
- `scripts/check-slug-quality.js` checks post slugs only.

Neither covers `src/pages/recursos/`. Citing them as guide gates is
explicitly forbidden.

Required gates for each new guide (page-level or dedicated validator):

1. `npm run lint` exits 0 (includes prettier + eslint + doc checks).
2. `npm run validate:content` exits 0 (includes `astro check` so the new
   Markdown route compiles under `MarkdownLayout.astro`).
3. `npm run build` exits 0 — new guides are public routes, and only a full
   build proves the generated route, sitemap entry, and search index
   survive production output.
4. `npm run test:dist` exits 0 — dist regression coverage for the new route
   (renders, no broken assets, indexed where expected).
5. `npm run check:doc-drift` exits 0.
6. `npm run test:audit` passes.
7. Manual page-level checks until a dedicated validator exists in the build:
   permalink collision check against existing posts/pages, cross-link target
   check (DailyDesk / detector / metodologia / newsletter targets resolve),
   mobile 375px + desktop 1280px render with no console errors, no broken
   images, meaningful `alt` text policy honored.
8. If guides recur, add a dedicated page-level validator to the build (route
   exists, frontmatter shape matches the hype guide, outbound links resolve)
   rather than stretching post-only scripts to cover pages.

## Homepage section plan (no component changes)

- Keep the existing `src/components/common/DailyDesk.astro` "Para leer con
  criterio" section (plain-`<a>` cards — link-capable, no prop changes).
- Phase 1 (this spike + guide #1): keep 3 slots, rotate guide #1 into the
  lead slot alongside metodologia + buscar, or extend the grid to 4 cards
  (`md:grid-cols-3` → 2×2 on the section's own grid) if design review
  prefers no rotation. Decision at implementation time; no `ds`/`template`
  boundary change either way.
- Phase 2 (guides #2–3): stable 4-card "library" row — Detector de hype +
  the two strongest companions — with metodologia + buscar moving to a
  second row or the section footer. Newsletter rail (`NewsletterCapture`)
  below the section stays the conversion point.
- Never wire guides into `RelatedReading`, `TopicStrip`, or `ArticleRail`
  without a priced component change (see link constraint above).

## Success metric

Measurable at ship time (no instrumentation needed): all 8 gates above
green, each guide reachable at its permalink with working cross-links,
listed in both LLM routes, and present in the sitemap. These are output
criteria — they prove the guides exist and are discoverable, nothing more.

Engagement outcomes (subscriptions/session, detector→guide CTR,
guide→newsletter CTR, return-weekly) are explicitly deferred until plan-003
analytics lands: with analytics off, pageview-only tooling cannot observe
RSS clicks or time-on-page, so any "proxy with current tooling" claim would
be unverifiable. Do not claim post-pipeline metrics (editorial score,
confidence) for static pages. Revisit this section the day the beacon
ships real data.

## Open questions (3 max)

1. Four-card grid vs. three-card rotation in "Para leer con criterio" — who
   makes the visual call at implementation time?
2. Should guides share one "hub" index route later, or stay as three
   standalone DailyDesk cards (current plan: no index route)?
3. Dedicated `recursos` link validator in the build now, or manual
   page-level checks until guide #2?
