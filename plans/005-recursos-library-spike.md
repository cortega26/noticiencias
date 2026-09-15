# Plan 005: Spike the evergreen recursos library (from one page to a hub)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- src/pages/recursos/ src/components/common/DailyDesk.astro src/pages/metodologia.md src/pages/newsletter.astro docs/EDITORIAL_VOICE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (compounding value, no urgency; pairs with plan 001's newsletter as fuel for editions)
- **Effort**: S–M (spike: 3-guide shortlist with outlines + ownership/cadence brief)
- **Risk**: LOW (spike writes one brief doc only; no content or layout changes)
- **Depends on**: none (soft: plan 003 traffic data would rank guide topics by demand)
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The homepage's "Para leer con criterio" section promises a reader-literacy
destination, but `/recursos/` is a single page padded with methodology and
search links. The format is proven (the hype guide is the site's most
linkable trust asset) and the marginal cost per guide is tiny — same
`MarkdownLayout`, same SEO path, no new infra. Three companion guides turn
a filler section into a durable library that the newsletter (plan 001),
search, and article rails can point at for years. The risk to contain is
scope creep into a generic science blog; this spike draws that boundary
before anyone writes a word.

## Current state

The facts the executor needs, inlined:

- `src/pages/recursos/` contains exactly one file:
  `detector-de-hype.md` — frontmatter `layout: '~/layouts/template/MarkdownLayout.astro'`,
  a five-question reader's guide ending with a newsletter CTA
  (`detector-de-hype.md:90-94`: "Cada viernes enviamos **Noticiencias
  Semanal**… [Suscribirme al boletín](/newsletter)"). New guides reuse this
  exact shape — no layout work needed.
- Homepage filler: `src/components/common/DailyDesk.astro:144-178` —
  "Para leer con criterio" with three cards: Detector de hype (real),
  "Cómo trabajamos" → `/metodologia/` (institutional, not a guide),
  "Buscar en el archivo" → `/buscar/` (tool, not a guide). Two of three
  cards are not reading guides — the section reads as one article plus padding.
- Voice boundary: `docs/EDITORIAL_VOICE.md` (canonical doctrine per the
  visual-refresh backlog) + `docs/EDITORIAL.md` ("Cursiva + Explicación" for
  anglicisms, informative-rigorous-accessible tone). Guides must read as
  "criterio lector" (how to read science), never as news or explainer
  duplication of article content.
- Cross-link surfaces (constrained — verify before promising): `RelatedReading`
  requires normalized `Post[]`, `TopicStrip` builds tag permalinks from
  `TopicFrequency`, and `ArticleRail` renders only a post's summary /
  glossary / sources — none accepts an arbitrary static-page target today.
  Link-capable surfaces for guides (plain `<a>` links, no component
  changes): DailyDesk cards, newsletter CTAs, detector-de-hype cross-links,
  metodologia-style Markdown links. The brief must EITHER restrict its link
  targets to these OR price the component/data-flow changes; it must not
  assume `RelatedReading`/`TopicStrip`/`ArticleRail` can point at
  `/recursos/*` as-is.
- Repo conventions: the post-oriented validators (`check-frontmatter-dates.js`
  walks `src/content/posts/` via `POSTS_DIR`; `check-slug-quality.js` rejects
  `article-NNN` post slugs) do NOT inspect `src/pages/recursos/`. The brief
  must identify which page-level checks (if any) cover future guides, or
  require a dedicated recursos validator in the later build — it must not
  cite post-only checks as guide gates. `check:doc-drift` covers active docs
  as usual.

## Commands you will need

| Purpose                     | Command                    | Provenance | Expected on success |
| --------------------------- | -------------------------- | ---------- | ------------------- |
| Baseline lint               | `npm run lint`             | declared   | exit 0              |
| Baseline content validation | `npm run validate:content` | declared   | exit 0              |
| Doc-drift gate              | `npm run check:doc-drift`  | declared   | exit 0              |
| Audit suite                 | `npm run test:audit`       | declared   | all pass            |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor. Broken on unmodified checkout → STOP, report, don't fix.

## Scope

**In scope** (the only files you should modify):

- `docs/recursos-library-brief.md` (create — the spike deliverable)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `src/pages/recursos/*` — no new guides written in a spike.
- `DailyDesk.astro`, `MarkdownLayout.astro` — no layout/section changes.
- `docs/EDITORIAL_VOICE.md`, `docs/EDITORIAL.md` — read the voice docs;
  do not revise doctrine in a content spike.

## Git workflow

- Branch: `advisor/005-recursos-library-spike`
- Commit style: conventional (e.g. `docs: spike recursos library brief (plan 005)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`
unmodified. **STOP and report** (command + output) on any failure.

**Verify**: all three exit 0. Also record `git rev-parse --short HEAD` as
`<start-SHA>` — the Done-criteria scope check uses it, not `8af478b`.

### Step 1: Confirm the one-page reality

**Verify**: `ls src/pages/recursos/` shows only `detector-de-hype.md`, and
`DailyDesk.astro:144-178` still links metodologia + buscar as the other two
"Para leer con criterio" cards. If a second guide or a recursos index
already exists, **STOP and report** — premise partially answered.

### Step 2: Shortlist 3 guides with outlines

Propose exactly 3 companion guides (candidates, not mandates: cómo leer un
paper científico; preprint vs. revisado por pares; cómo citar y rastrear
fuentes / DOI). For each: working title, 5-section outline mirroring the
hype guide's question-led structure, why it fits "criterio lector" (and
what adjacent topic it explicitly excludes to prevent blog-drift), target
length, and which link-capable surfaces point to it (DailyDesk cards,
newsletter welcome/CTA, detector-de-hype cross-link — NOT `RelatedReading` /
`TopicStrip` / `ArticleRail`, which cannot target static pages as-is; see
Current state). Rank 1–3 with one-line reasons.

**Verify**: 3 outlines drafted, each with explicit exclusion boundary.

### Step 3: Write `docs/recursos-library-brief.md`

Sections: boundary statement (what recursos is/isn't, quoting the voice
docs), the 3 ranked outlines, ownership + freshness cadence (who reviews
each guide and how often — evergreen rots without an owner), validation
gates for future guides (page-level checks that actually cover
`src/pages/recursos/`, or a dedicated validator requirement for the build —
NOT the post-only frontmatter/slug checks; see Current state), homepage
section plan (what the 3 cards become once guides exist), success metric
proposal (guide entrances via plan 003 analytics; without it, RSS/search
referrals as proxy), and max 3 open questions.

**Verify**: `npm run check:doc-drift` exits 0 (new active doc must not
break drift gates), `npm run test:audit` passes, `git status --short`
shows only the brief + `plans/README.md`.

## Test plan

No production code changes, no new unit tests.

- `npm run test:audit` → all pass; `npm run check:doc-drift` → exit 0.
- Cold-read test: a writer who has not seen this plan can draft guide #1
  from its outline + boundary without asking a scoping question.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`, `npm run test:audit` all exit 0 / pass
- [ ] `docs/recursos-library-brief.md` exists with boundary + 3 ranked outlines (each with exclusion) + ownership/cadence + gates + homepage plan
- [ ] `git diff --name-only <start-SHA>...HEAD -- docs/recursos-library-brief.md plans/README.md` (three dots; `<start-SHA>` is the commit you recorded in Step 0, NOT `8af478b`, which predates unrelated landings and would fail this gate) lists only those two files
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report (do not improvise) if:

- "Current state" excerpts don't match live code (drift).
- A second guide or recursos index already exists (premise answered).
- Verification fails twice after reasonable fix attempts.
- Scoping needs out-of-scope edits (e.g. voice-doctrine changes).
- A `declared` command is missing/broken on the unmodified checkout.

## Maintenance notes

- Each guide is a freshness promise: the ownership/cadence section is the
  most important part of the brief — unenforced evergreen content rots.
- Reviewer scrutiny: blog-drift — every future guide PR should cite its
  exclusion boundary from this brief.
- **Deferred:** guide #4+ and translations — only after the first 3 ship
  and entrance metrics exist (plan 003).
- **Deferred:** interactive guide elements (quizzes, checklists as
  components) — LAW-F3 says static prose first; add interactivity only on
  evidence readers finish the prose.
