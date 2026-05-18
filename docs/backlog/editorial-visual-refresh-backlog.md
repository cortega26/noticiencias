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

## High priority

### D6 — Investigation archetype visual differentiation

Problem: The schema field `investigation: true` already exists and is documented in `EDITORIAL_VOICE.md` section 3.3, but the front-end gives investigation pieces no visible differentiation from regular articles. The frontmatter contract is making a promise the UI doesn't honor.
Impact: Editorial effort spent on investigation pieces (manual review, multiple sources, fact-checks) is invisible to readers. Marking `investigation: true` costs nothing today, which erodes the meaning of the flag and weakens trust signals.
Recommendation: Surface investigation pieces with a visible badge on cards and in the article header, a slightly different headline type treatment, and preferential placement in the home `featured` slot. Implementation should respect the layer boundary (`ds → template → pages`).
Affected repo(s): frontend.
Suggested priority: high.

Files to touch:

- `src/components/ds/atoms/` — new `<InvestigationBadge.astro />` atom (label "Investigación Noticiencias", Indigo accent, small icon optional via tabler:microscope or tabler:flask).
- `src/components/ds/organisms/ArticleCard.astro` — when `post.investigation`, render `<InvestigationBadge />` in the metadata row above the title; for `variant="lead"`, swap the heading font to `font-serif` (Playfair Display already loaded) at the same size.
- `src/layouts/PostLayout.astro` — show `<InvestigationBadge />` in the header row (around line 78-89), switch `<h1>` to `font-serif` only when `post.investigation`.
- `src/utils/hub.ts` — `selectFeaturedPosts` may need to prefer `investigation: true` posts when available (look at the existing function and decide whether to extend it or leave selection logic alone).

Acceptance criteria:

- Cards with `investigation: true` show a visible badge above the title on `/` and `/blog/`.
- Article page header shows the same badge in the metadata row.
- Article title renders in serif when `investigation: true`; sans-serif otherwise.
- Existing tests pass; add one unit test in `tests/` that renders an `ArticleCard` with `investigation: true` and asserts the badge text is present.
- `npm run lint && npm run build && npx vitest run` all green.

Risk: Low. Purely additive UI on an existing schema field. No data migration.

### D7 — "Qué cambia" archetype visual treatment

Problem: `EDITORIAL_VOICE.md` section 3.4 defines "Qué cambia" as a first-class archetype (consequence-of-a-known-fact), but in `DailyDesk.astro:89-103` it renders as plain `<ArticleCard variant="compact">` like any sub-section. The archetype loses its distinctness in the visual hierarchy.
Impact: The reader cannot scan the home and recognize "this section answers 'what changes for me'". The contextual value the archetype is meant to deliver gets buried.
Recommendation: Give "Qué cambia" a dedicated card variant or a wrapper component that visually marks the _consequence_ — `why_it_matters[]` should be the lead element, not the title; an ámbito kicker (Política/Salud/Industria/Vida cotidiana) should be visible on the card.
Affected repo(s): frontend.
Suggested priority: high.

Files to touch:

- `src/components/ds/organisms/ArticleCard.astro` — add `variant="consequence"` (or create a sibling component `<ConsequenceCard />` in the same directory if the existing variants get crowded).
- `src/components/common/DailyDesk.astro:89-103` — use the new variant/component for the `contextPosts` section, and refine the section heading copy if needed (currently "Qué cambia").
- `src/utils/hub.ts` — `selectContextPosts` already drives this; verify the selection prefers posts with `why_it_matters[]` populated.

Open question to resolve before implementing: where does the "ámbito" come from? Options: (a) infer from `categories[]`, (b) introduce an opt-in `ambito` field in the schema (requires LAW-F1 cross-repo schema change), (c) pick the first `why_it_matters[]` entry's leading noun heuristically. Option (a) is the cheapest and respects the sealed schema; recommend starting there.

Acceptance criteria:

- "Qué cambia" cards on `/` are visually distinct from `compact` cards (different background or border accent, `why_it_matters` lead visible).
- An "ámbito" kicker appears above the title.
- The section heading remains "Qué cambia" (or is replaced by a copy that passes the AI-magazine ban list in `tests/quick-wins-regression.test.ts`).
- `npm run lint && npm run build && npx vitest run` all green.

Risk: Low if option (a) is taken. Medium if option (b) requires backend schema coordination.

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
| D6 — Investigation visual              |       ✓       |              |      |
| D7 — Qué cambia visual                 |       ✓       |              |      |
| D5 — uncertainty emphasis              |               |              |  ✓   |
| D8 follow-up — Widget Button migration |       ✓       |              |      |
| `.astro/` untrack                      |       ✓       |              |      |
| MD5 → SHA-256                          |               |      ✓       |      |
| dist-stale test fix                    |       ✓       |              |      |

## Related persistent memory

If using Claude/Agent SDK with the `auto memory` system, the following memory entries already document the strategic context and should be consulted before starting any item:

- `feedback-editorial-voice` — voice direction (curioso/riguroso, línea roja).
- `editorial-voice-doc` — pointer to `docs/EDITORIAL_VOICE.md` as canonical.
- `backend-prompts-pipeline` — backend prompt locations + headline_critic mechanism.
- `promise-revisit-2026-06-17` — calendar reminder to revisit the Editorial Promise.

These live under the project's `memory/` directory in the Claude harness; they are not part of either git repo.
