# ADR-0010: Correction Policy and Moderation Flow (Spike)

- **Date**: 2026-09-15
- **Status**: Accepted (operator 2026-09-17; build unscheduled — waits for coordinated schema-change capacity, see Resolved questions Q2)

## Context

`src/pages/transparencia.md:12-15` promises documented corrections with an
updated modification date when relevant. The intake half of that promise
exists: `src/pages/reportar-problema.astro` (noindex) renders `ReportForm`
(`src/components/template/widgets/ReportForm.astro`), which POSTs JSON to the
Worker (`workers/src/handlers/report.ts:22-80`). The handler validates via
`validateReportPayload`, enforces a 20KB body cap, applies a 10-minute
idempotency window, and persists an R2 record keyed
`reports/YYYY-MM-DD/<uuid>.json` (record fields: `id`, `problem_type`,
`article_url`, `description`, `content_snippet`, `evidence_url`,
`tech_browser`, `tech_os`, `reporter_email`, `submitted_at`, `environment`,
`user_agent`).

The visible half does not exist. `src/layouts/PostLayout.astro:77-101` emits
`dateModified` (`PostLayout.astro:84`) in JSON-LD only; the rendered header
shows only the publish date. `grep -rni "correcci" src/components/
src/layouts/ src/pages/` returns form and policy prose only — no correction
display component. `src/pages/admin/dashboard.astro` reads
`data/metrics/pipeline-metrics.json` and contains zero report references, so
reports are invisible to readers and to editors. This ADR designs the missing
half. It builds nothing and changes no moderation behavior.

## Decision

### Correction taxonomy (3 tiers)

Rule: typos are silent; changed claims, numbers, or conclusions are public.

| Tier                       | What qualifies                                                                                                              | Rendered-article update vs log-only                                                                                           | Bumps `dateModified`? | Science-article example                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| T1 — Silent fix            | Typos, grammar, punctuation, broken intra-article anchors, layout glitches that do not change meaning                       | Update rendered article; no visible correction entry                                                                          | No                    | Fixing "fotosintesis" spelling or a misplaced comma in a methods summary                                                   |
| T2 — Noted correction      | Wrong number, unit, date, name, misattributed or miscited source, mistranslation that shifts meaning, corrected chart label | Update rendered article AND append a visible correction entry (date + what changed)                                           | Yes                   | Dose reported as "150 mg" corrected to "15 mg"; source link pointed at the wrong trial                                     |
| T3 — Substantive amendment | A claim, interpretation, or conclusion changes after re-verification (new data, retracted source, wrong verdict)            | Update rendered article, append a visible correction entry, and re-check the TrustPanel state (confidence / uncertainty note) | Yes                   | Article concluded a supplement "reduces risk"; corrected to "evidence is inconclusive" after the cited review is rechecked |

Boundary: correct without defaming. A correction states what changed and what
is now accurate; it does not attribute motive or misconduct to any person or
institution. Disputed or still-open science is NOT a correction — it belongs
in the uncertainty note (`uncertainty_note` / `requires_uncertainty_note`),
not in the corrections log. A correction records a resolved editorial change;
an uncertainty note marks what is still unknown.

### Moderation flow: R2 sink to published correction

Triage states: `received` → `triaged` → (`verified` | `rejected` |
`duplicate` | `abuse`) → `approved` → `published`. Only `approved` records
become visible, and only as an editor-written correction entry — never as
verbatim reporter text.

- Human-in-the-loop approval is mandatory. There is no auto-publish path from
  R2 (or email notification) to the rendered article. An editor verifies the
  claim against the primary source, assigns a tier (T1/T2/T3), and writes the
  correction entry.
- T1 may be applied during normal editing without a second reviewer; T2 and
  T3 require explicit editorial approval before publish (approval is a role,
  not a specific headcount — see open questions).
- Duplicates link to the canonical report; rejections need no public trace.
- Reporter identity is never published. Correction entries contain only the
  correction date, the tier-appropriate description of what changed, and the
  corrected article state. Reporter contact and raw report text stay in the
  private triage queue.

Frontend delivery (2 options priced):

- Option A — frontmatter `corrections:` via backend republication (RECOMMENDED).
  The backend republishes the article Markdown with a `corrections:` array;
  the frontend validates it in the posts schema, normalizes it with the rest
  of the post data, and renders it. One source of truth, versioned with the
  article, consistent with the existing republication pipeline.
- Option B — build-time sidecar file (e.g. a per-article corrections file
  joined at build time). No schema change, but a second source of truth that
  can orphan or disagree with the article on renames, permalink overrides,
  and backfills.

Recommend Option A despite its higher coordination cost, because corrections
are editorial content that belongs with the article revision history.

Abuse handling: the existing intake context is validation-first
(`validateReportPayload`), a 20KB cap, per-IP rate limiting via KV, a
10-minute idempotency window, and a 503 when no durable sink succeeds. On top
of that, triage adds an `abuse` terminal state (spam, harassment, bulk
submissions, demands to "balance" without evidence — the latter already
excluded at `reportar-problema.astro:43-53`). Abuse records are dropped from
the queue, never rendered, and repeated abuse is handled at the rate-limit /
block level, not in the article.

### UI placement sketch (adjacent to TrustPanel, no code)

The correction notice lives on the article page directly above the TrustPanel
(`src/layouts/PostLayout.astro:215-223`), reusing the `why_it_matters`
prologue callout house style (`PostLayout.astro:185-196`): a bordered callout
with a heading and a short list. ASCII sketch only:

    +--------------------------------------------------+
    |  Correcciones (1) · Actualizado <fecha>          |
    |  - <fecha>: <qué cambió en una línea>            |
    +--------------------------------------------------+
    +--------------------------------------------------+
    |  Fuentes y verificación (TrustPanel existente)   |
    |  Estado de la evidencia · Qué falta saber · ...  |
    +--------------------------------------------------+

T1 fixes show no callout. T2 shows one dated line per correction. T3 shows the
dated lines plus the updated TrustPanel state. No reporter data, no raw report
text, no counts of rejected reports.

### Dashboard observability note

`src/pages/admin/dashboard.astro` currently has no report visibility. Add
aggregated counts to the dashboard metrics (received / triaged / published,
plus median time from `received` to `published`, bucketed by tier). Counts
only — no reporter identities, contact details, or report bodies in metrics.

## Governance (LAW-F1 / LAW-F2)

- LAW-F1 (content schema is sealed): Option A introduces a `corrections:`
  frontmatter field, which is a sealed cross-repo schema change. It requires a
  coordinated backend + frontend release (schema update, normalization in the
  content/utils layer, validation of existing posts) and must be treated as
  Critical per the change matrix. Option B avoids the schema change but is
  rejected for the drift reasons above.
- LAW-F2 (fixed responsibilities): correction data reaches the layout only as
  normalized post data (via the content/utils layer, as TrustPanel props
  already do at `PostLayout.astro:215-223`). Layouts and presentational
  components do not query reports, parse R2 records, or repair content. Triage
  state machines and queue views live outside the article rendering path.

## Proposed transparencia.md wording (not applied)

> ## Correcciones
>
> Si detectas un error, usa [Reportar un problema](/reportar-problema/). Cada
> reporte lo revisa una persona del equipo editorial; nada se publica
> automáticamente.
>
> - Erratas menores (ortografía, formato) se corrigen en silencio.
> - Errores con impacto (datos, cifras, fuentes, traducciones que cambian el
>   sentido) se corrigen en el artículo con una nota fechada y actualizamos la
>   fecha de modificación.
> - Cambios de fondo (una afirmación o conclusión cambia tras re-verificar) se
>   corrigen con nota fechada y revisamos el estado de evidencia del artículo.
> - La ciencia en disputa no es una corrección: la marcamos como incertidumbre
>   pendiente en el propio artículo.
>
> Nunca publicamos tu identidad ni el texto de tu reporte; solo la corrección
> editorial resultante.

## Consequences

- Readers gain a visible, predictable corrections record; editors gain a
  defined triage path from the existing R2 sink to a published entry.
- Intake, rate limiting, and storage stay unchanged; this spike adds no new
  runtime, dependency, or hydrated UI.
- Accepting Option A commits both repos to a coordinated schema change before
  any visible correction can ship.

## Alternatives considered

| Option                                            | Reason rejected                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Auto-publish verified-looking reports             | No verifiable trust signal exists in the intake record; bypasses mandatory human review and risks defamation or manipulation |
| Render raw report text as "community corrections" | Leaks reporter PII, publishes unverified claims, violates LAW-F6 (normalization before rendering)                            |
| Sidecar file instead of frontmatter (Option B)    | Second source of truth; orphans on renames/permalink overrides; duplicates join logic against the permalink helpers          |

## Open questions

> Resolved by operator 2026-09-17 (solo-maintainer ruling: minimize process
> overhead and tech debt; revisit only when a second editor exists or a real
> correction forces the issue).
>
> 1. **T2/T3 approval: single-editor approval is sufficient.** A
>    second-reviewer rule is unenforceable with one maintainer. Revisit when
>    a second editor joins.
> 2. **No interim sidecar.** Shipping a temporary sidecar buys exactly the
>    second-source-of-truth drift this ADR rejects under Option B. Visible
>    corrections wait for backend `corrections:` republication support; the
>    build stays unscheduled until coordinated schema-change capacity exists.
> 3. **T1 stays invisible to `dateModified`.** Bumping modification dates for
>    typo fixes pollutes sitemaps/feeds for zero reader value.

Original questions (kept for the record):

1. Should T2/T3 approval require a second reviewer, or is single-editor approval sufficient at current volume?
2. Should a lightweight sidecar ship as an interim before the backend supports `corrections:` republication, with a defined sunset?
3. Should T1 silent fixes bump `dateModified`, or stay invisible to it as proposed?
