# Noticiencias — UI/UX implementation plan

**Source:** UX audit completed 24 may 2026 (`Noticiencias Audit.html`).
**Target repo:** this one. **For use with:** Claude Code.

## How to use this file

1. Drop this file at the root of the repo (or `docs/`).
2. Open Claude Code in the repo.
3. Pick one task at a time. Tell Claude Code:
   _"Implement task **QW-1** from `noticiencias-ui-improvements-plan.md`. Run `npm run lint && npm run validate:content && npm run build` when done."_
4. Review the diff. Merge. Repeat with the next task.

Each task is scoped to be a single PR. Quick wins (QW-*) target one file each. Priority improvements (PR-*) touch 2–5 files and need a design decision call out before coding.

The acceptance criteria are written as commands you can paste back at Claude Code to verify the change landed correctly.

---

## Section A — Quick wins (each ≤ 1 hour)

### QW-1 — Stop using English source titles as image alt text

**Files**

- `src/components/ds/organisms/ArticleCard.astro`
- `src/layouts/PostLayout.astro`
- `scripts/check-hero-images.js` (or new `scripts/check-image-alt.js`)
- Every post in `src/content/posts/` missing a proper `image_alt`

**Problem**

`ArticleCard.astro` line ~23:

```ts
const imageAlt = post.image_alt || post.title;
```

When `image_alt` is missing, the fallback uses `post.title` — but for posts where the title isn't set, downstream renders fall through to `refinery_id` (the English source-paper title). Result: alt text reads "Imagen de SpaceX launches Starship V3—the world's most powerful and tallest rocket ever".

**Change**

1. Remove the silent fallback. If `image_alt` is missing in production, the build fails.
2. Add a lint script `check-image-alt.js` that asserts every post with an `image` has a non-empty `image_alt`, and rejects values starting with `"Imagen de"` (redundant for screen readers).
3. Backfill `image_alt` for all 17 `article-NNN` posts and any other posts surfaced by the new lint.

**Acceptance**

```bash
npm run lint                    # passes; check-image-alt is in the chain
grep -r "Imagen de" src/content/posts | wc -l    # → 0
```

In dev mode, every `<img>` on the homepage should have a Spanish-language alt that describes the image, not the source paper.

---

### QW-2 — One date helper, two variants

**Files**

- `src/utils/utils.ts` (extend `getFormattedDate`)
- `src/components/common/DailyDesk.astro` (remove inline `toLocaleDateString` call)
- Any other place using `Date.prototype.toLocaleDateString` directly

**Problem**

`DailyDesk.astro:22` has inline `toLocaleDateString('es-ES', { day, month: 'long', year })` for the front-page eyebrow ("24 de mayo de 2026"). Article cards use `getFormattedDate(post.publishDate)` from `utils/utils.ts` which renders short form ("23 may 2026"). Three formats live across the homepage simultaneously.

**Change**

1. Extend `getFormattedDate(date, variant?: 'compact' | 'long' | 'relative')` to be the single source of date formatting. Default = `compact`.
2. Add `'relative'` variant: returns "hace 2 días" / "hace 3 horas" for dates < 7 days old, else falls through to compact.
3. Replace the inline call in `DailyDesk.astro` with `getFormattedDate(now, 'long')`.
4. Grep the repo for other inline `toLocaleDateString` and route them through the helper.

**Acceptance**

```bash
grep -r "toLocaleDateString" src/components src/layouts | wc -l   # → 0
grep -r "toLocaleDateString" src/utils/utils.ts                   # → only inside getFormattedDate
```

Visual: homepage renders one consistent format. The most-recent card on the homepage shows a relative time ("hace 3 días") if published within 7 days.

---

### QW-3 — Reject `article-NNN` slugs at build time

**Files**

- New: `scripts/check-slug-quality.js`
- `package.json` → add to the `lint` script chain
- `src/content/posts/` → fix or remove the 17 offending posts

**Problem**

Slugs like `2026-01-31-article-520.md` reach production. The category rails on the homepage surface them; their public URLs become `/ciencia/2026-01-31-article-520/`.

**Inventory of offending posts (currently committed)**

```
article-36, article-64, article-86, article-87, article-107, article-206,
article-213, article-235, article-250, article-279, article-343, article-349,
article-432, article-520, article-521, article-657, article-677, article-849
```

**Change**

1. Create `scripts/check-slug-quality.js` following the pattern of `check-hero-images.js`.
2. Reject `^\d{4}-\d{2}-\d{2}-article-\d+$`. Exit non-zero with the offending file paths.
3. Hook into the existing `lint` and `validate:content` chains in `package.json`.
4. For the 17 existing posts: regenerate the slug from the (translated, Spanish) title.

**Acceptance**

```bash
npm run lint                                          # passes
ls src/content/posts | grep -E "article-[0-9]+" | wc -l    # → 0
```

The site no longer surfaces `/categoria/article-NNN/` URLs anywhere — including the sitemap.

---

### QW-4 — Hide the newsletter form when the endpoint isn't wired

**File**

- `src/components/common/NewsletterCapture.astro`

**Problem**

Right now the component renders a full email form with `disabled` input/button + a disclaimer reading _"La captura de correos se activará al configurar el endpoint del formulario."_ This is the worst kind of "site feels half-finished" — a visibly-broken control.

**Change**

When `APP_CONFIG.form.endpoint` is empty, render a slimmed-down alt: heading + paragraph + two real CTAs ("RSS" and "Ver archivo") and **no form element**. The form only appears when the endpoint is configured.

**Pseudo-diff**

```astro
{isEnabled ? (
  <!-- existing form markup -->
) : (
  <div class="flex flex-wrap gap-3">
    <a href={getAsset('/rss.xml')} class="...">RSS</a>
    <a href="/blog/" class="...">Ver archivo</a>
  </div>
)}
```

**Acceptance**

With `form.endpoint: ''` in `src/config.yaml`, the homepage no longer renders an `<input type="email">`. With a real endpoint, the form returns.

```bash
grep -c "input type=\"email\"" dist/index.html         # → 0 when endpoint empty
```

---

### QW-5 — Topic strip: filter `count >= 2`, sort desc, cap at 6

**Files**

- `src/utils/hub.ts` → `getTopicFrequency`
- (optional) `src/components/common/TopicStrip.astro` → render an empty state instead of the strip when there are <3 repeats

**Problem**

The strip under the lead post is titled "Los temas que más se repiten en la edición reciente" but currently shows 12 tags with `count = 1` because the filter is missing.

**Change**

In `getTopicFrequency`:

1. Filter `entries.filter(([, count]) => count >= 2)`.
2. Sort by count desc, then alphabetical on ties.
3. Cap to 6.
4. Return `[]` (not a fallback list) when nothing qualifies.

In `TopicStrip.astro`: if `topics.length === 0`, render nothing — don't print "En seguimiento" with an empty body.

**Acceptance**

On the homepage today, "En seguimiento" should either show 1–6 chips, each with count ≥ 2 — or disappear entirely. No chips with `1` next to them.

```bash
# After build:
grep -A1 "En seguimiento" dist/index.html | grep -oE ">[0-9]+<" | sort -u
# → no occurrence of ">1<"
```

---

## Section B — Priority improvements (each ½–2 days, needs a small design decision)

### PR-1 — Surface the primary source above-the-fold

**Files**

- New: `src/components/ds/molecules/SourceLine.astro`
- `src/components/ds/organisms/ArticleCard.astro` (mount in card meta)
- `src/layouts/PostLayout.astro` (mount in header)
- `src/content.config.ts` (confirm `source_url` + a new `source_publisher` field)
- A migration to backfill `source_publisher` for existing posts (derive from `source_url` hostname)

**Decision needed before coding**

What exactly do we show?

- Option A (recommended): `Fuente: <publisher>` + optional `· traducción NotiAI`.
- Option B: `<publisher>` as an active link to the source.
- Option C: source domain only (`security.googleblog.com`).

Recommend A: clean, attributes properly, keeps the source link inside the existing `TrustPanel` at article bottom.

**Change**

1. Add `source_publisher: z.string().optional()` to the post schema. Derive a default from `source_url` via a `hostnameToPublisher` map (e.g., `security.googleblog.com` → "Google Security Blog").
2. Render `<SourceLine />` between the meta row and the title in `ArticleCard` (all variants except `consequence`) and in the article header.
3. In `PostLayout`, this replaces the redundant "Por <author>" line for posts where the author is `Noticiencias AI` — the byline becomes a source line + translation note.

**Acceptance**

- Every `ArticleCard` on the homepage shows a publisher line.
- The article page shows `Fuente: Google Security Blog · traducción NotiAI · revisión humana` above the lede.
- `TrustPanel` at the bottom keeps the full source list with links — don't remove it.

---

### PR-2 — Visually separate categories from tags

**Files**

- `src/components/ds/atoms/TopicBadge.astro` (categories only — use a closed color map)
- `src/components/ds/atoms/TagPill.astro` (already exists — make it the tag-only treatment)
- `src/components/ds/organisms/ArticleCard.astro` (use TopicBadge for category, TagPill for tags, never both in the same row)
- `src/layouts/PostLayout.astro` (move tags out of the header meta row → to a dedicated section below the body)
- `src/utils/categorySections.ts` (or new `src/data/categories.ts`) → explicit color map per category slug

**Decision needed**

Confirm the eight category slugs + their colors. Suggested:

| slug         | color (light)               |
| ------------ | --------------------------- |
| ciencia      | indigo-700 on indigo-50     |
| astronomia   | violet-700 on violet-50     |
| salud        | teal-700 on teal-50         |
| tecnologia   | sky-700 on sky-50           |
| editorial    | slate-700 on slate-100      |
| fisica       | indigo-700 on indigo-50     |
| quimica      | amber-700 on amber-50       |
| biologia     | emerald-700 on emerald-50   |
| arqueologia  | stone-700 on stone-100      |

**Change**

1. Replace the `lower.includes()` cascade in `TopicBadge.astro` with a lookup from an explicit map keyed by category slug. Unknown slug → render nothing (don't fall back to a generic gray badge — assert at build).
2. In `ArticleCard.astro` meta row: render only `TopicBadge` (the category) — never `TagPill`.
3. Tags render only on the article page, in a dedicated `<section>` below the body, before the related-reading rail.

**Acceptance**

- A reader cannot mistake a tag for a category on any card.
- Header navigation surfaces only categories, never tag links.
- The substring-based color logic is gone — `grep -n "lower.includes" src/components/ds/atoms/` returns nothing.

---

### PR-3 — Match the cadence promise to reality

**Files**

- `src/config.yaml` → meta description
- `src/components/common/DailyDesk.astro` → eyebrow and h1 copy
- `src/utils/hub.ts` → `getEditionDate(posts)` returning the most recent `publishDate`
- `src/pages/index.astro` → pass it into `DailyDesk`

**Decision needed**

What cadence is the project actually committing to?

- Option A — Daily for real: start publishing daily; keep "edición diaria" copy.
- Option B (recommended for now): "Selección semanal". Adjust copy + eyebrow.
- Option C: Variable — drop the cadence word entirely; eyebrow shows the date of the most recent piece.

This is mostly a copy + data decision. The implementation is short either way.

**Change** (assuming Option B)

1. `config.yaml`: description → `"Una selección semanal de ciencia y tecnología en español, con fuente primaria y contexto para entender qué cambia."`
2. `DailyDesk.astro`: eyebrow `"Edición del {compactDate(getEditionDate(allPosts))} · {nPosts} piezas"`. h1 `"La ciencia que conviene seguir esta semana."` Add a small line under the lede: `"Próxima edición: <next Friday compact>"`.
3. `getEditionDate(posts: Post[])` returns the publishDate of the freshest post.

**Acceptance**

- Homepage eyebrow reflects the actual freshness of content, not `new Date()`.
- The metadata description and the headline agree on cadence.

---

### PR-4 — Sticky context rail for article reading on desktop

**Files**

- `src/layouts/PostLayout.astro` (rearrange section order + add desktop grid)
- New: `src/components/ds/molecules/ArticleRail.astro` (composes `En breve`, `Glosario`, `Fuentes` for the rail)
- `src/components/common/TrustPanel.astro` (split: brief summary for the rail, full list for the bottom of the article)
- `src/components/ds/molecules/KeyTakeaways.astro` (may stay as-is or fold into the rail)

**Decision needed**

Confirm what goes in the rail vs. in the body. Suggested:

- **Top of body, full width:** "Qué cambia" callout (this is editorial framing — belongs as a prologue).
- **Rail (desktop ≥ 1024px), sticky:** "En breve" (3 bullets), "Glosario" (collapsible), "Fuentes" (links).
- **End of body:** `TrustPanel` full (confidence + fact-check + uncertainty notes), `TopicStrip` for tags, related reading.

**Change**

1. `PostLayout` switches to `grid grid-cols-[1fr_280px] gap-10` at `lg:` for the body region.
2. The rail is `position: sticky; top: 80px;` and contains `<ArticleRail post={post} />`.
3. Move "Qué cambia" panel above the body (it currently renders below "En breve"); this is the editorial frame the lede should set up.
4. Mobile (< 1024px): same components render inline at the appropriate body positions — no rail.
5. Make sure the rail is `aria-hidden`-free and the order matches the document outline for screen readers.

**Acceptance**

- Desktop: the article body is no longer the full content column width. A sticky rail with En breve / Glosario / Fuentes is visible during scroll.
- Mobile: no rail; the same content appears inline.
- The number of stacked "panel" islands in the main body drops from 6 to 2 (Qué cambia + the prose, plus TrustPanel at the very end).

---

### PR-5 — Header search dialog with ⌘K / `/` shortcut

**Files**

- New: `src/components/common/HeaderSearch.astro` (or `SearchDialog.astro`)
- `src/components/template/widgets/Header.astro` (replace the static "Buscar" anchor with the dialog trigger)
- `src/pages/buscar.astro` (keep — accessible at `/buscar/` for SEO and as a no-JS fallback)
- `src/utils/browser/search-url.ts` (already handles URL syncing — reuse it)

**Decision needed**

- Use the native `<dialog>` element or a Headless-style div+aria-modal? Recommend native `<dialog>` for the focus trapping it gives for free.
- Trigger: button click + `/` (single key) + `⌘ K` (mac) / `Ctrl K` (win/linux).
- Should the dialog show recent posts by default before the user types? Recommend yes — 5 most recent.

**Change**

1. New `HeaderSearch.astro` mounts a `<dialog>` plus a button trigger. The dialog body has the input + result list. Open via the button or the keyboard shortcuts. ESC closes (native).
2. Move the Lunr boot logic out of `SearchInterface.astro` into a tiny module `~/utils/browser/search-index.ts` exporting `loadIndex()` + `search(query)`. **Both** the header dialog and `/buscar/` use it.
3. Boot the index `on first focus of the dialog input` (not on page-load). After the first open, the index is cached for subsequent opens.
4. Show 5 most-recent posts as a default state (no query). Use the same `/search.json` payload — adding `featured: true` or sorting by `date` desc client-side.
5. "Enter" navigates to the highlighted result. "Ver todos los resultados →" link at the bottom of the dialog falls back to `/buscar/?q=<query>` for users who want the full page.

**Acceptance**

- Header button no longer navigates to `/buscar/` on click; it opens an in-page dialog.
- Pressing `/` from anywhere (outside an input) opens the dialog.
- `/buscar/` still works as a standalone page (no-JS fallback + SEO).
- Time-to-first-input-acceptable on the dialog is < 100ms (vs. ~600ms today on `/buscar/`).
- Keyboard nav: ↑ ↓ move highlight, Enter follows, Esc closes.

---

## Order of operations (suggested)

Do quick wins first, in any order. They de-clutter the homepage and remove the most visible "feels broken" signals before the bigger work lands.

Then priority improvements, **in this order**:

1. **PR-3** (cadence) — copy-only change; sets honest expectations for everything else.
2. **PR-1** (source line) — high-impact, contained component work.
3. **PR-2** (categories vs tags) — touches several components; do it before adding more meta-row work.
4. **PR-5** (search) — independent.
5. **PR-4** (article rail) — biggest scope; benefits from PR-2 (category visual already settled) and PR-1 (source line in place).

## Verification checklist for any PR

```bash
npm run lint
npm run validate:content
npm run build
npm run test:dist
npm run test:audit
```

A green chain is the bar.
