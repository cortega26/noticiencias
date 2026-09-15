# Plan 002: Spike the corrections loop from invisible report sink to visible trust

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- src/pages/transparencia.md src/layouts/PostLayout.astro src/components/common/TrustPanel.astro workers/src/handlers/report.ts src/pages/reportar-problema.astro src/components/template/widgets/ReportForm.astro src/pages/admin/dashboard.astro docs/adr/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (spike: taxonomy + moderation flow + UI sketch as ADR draft)
- **Risk**: LOW (this plan writes one ADR draft file only; no production behavior changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The transparency page promises documented corrections with updated
modification dates, and a working report pipeline (form → Worker → R2 sink)
already accepts reader reports — but nothing visible ever comes out. The
intake exists; the output does not. A reader who reports an error today gets
a thank-you and silence, and future readers of the same article see no
correction note. This spike designs the missing half: what counts as a
correction, how a report becomes one, and where readers see it. It does NOT
build the UI or change moderation behavior.

## Current state

The facts the executor needs, inlined:

- Promise: `src/pages/transparencia.md:12-15`:

  ```md
  ## Correcciones

  Si detectas un error, abre un issue con la etiqueta `agents:proposal` o usa el formulario de contacto.
  Documentamos cambios relevantes y actualizamos la fecha de modificación cuando corresponde.
  ```

- Intake (exists, verified live per `docs/ARCHITECTURE.md`): `src/pages/reportar-problema.astro`
  (noindex contact channel distinguishing factual corrections from
  out-of-scope items, lines 28-54) renders `ReportForm`
  (`src/components/template/widgets/ReportForm.astro`), which POSTs JSON to
  the Worker. `workers/src/handlers/report.ts:1-11,22-80` validates the
  payload (`validateReportPayload`), enforces a 20KB body cap
  (`MAX_BODY_BYTES = 20_000`), applies a 10-minute idempotency window, and
  stores the record in R2 with a UUID (`id: crypto.randomUUID()`).
- Invisible output: `src/layouts/PostLayout.astro:77-101` emits
  `dateModified: (post.updateDate ?? post.publishDate).toISOString()` in
  JSON-LD (machine-readable only). No rendered correction note, no
  per-article history, no public log exists anywhere — confirm with
  `grep -rni "correcci" src/components/ src/layouts/` (expect only form/
  policy prose, no display component).
- Admin blind spot: `src/pages/admin/dashboard.astro` reads
  `data/metrics/pipeline-metrics.json` (content + image metrics) and has
  zero references to reports/social/newsletter (verified: grep for
  `social|newsletter|report|analytics` in that file matches only generic
  "metrics" lines).
- Related pattern to reuse: `TrustPanel` (`src/components/common/TrustPanel.astro`,
  rendered at `PostLayout.astro:215-223` with confidence/factCheck/sources/
  uncertaintyNote props) is the established "verification box" on every
  article — a correction note belongs adjacent to it, not as a new visual
  language. Per-article `why_it_matters` prologue (`PostLayout.astro:185-196`)
  shows the house style for bordered editorial callouts.
- Repo conventions: LAW-F2 (layouts must not acquire content logic —
  correction data must arrive via normalized post data, not layout
  fetching); LAW-F6 (normalization before rendering); LAW-F1 (adding a
  frontmatter field like `corrections:` is a sealed-schema, cross-repo
  contract change — the ADR must call this out explicitly).

## Commands you will need

| Purpose                     | Command                    | Provenance | Expected on success |
| --------------------------- | -------------------------- | ---------- | ------------------- |
| Baseline lint               | `npm run lint`             | declared   | exit 0              |
| Baseline content validation | `npm run validate:content` | declared   | exit 0              |
| Doc-drift gate              | `npm run check:doc-drift`  | declared   | exit 0              |
| Audit suite                 | `npm run test:audit`       | declared   | all pass            |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor. A `declared` command failing on the unmodified checkout is a
broken baseline — see Step 0.

## Scope

**In scope** (the only files you should modify):

- `docs/adr/0010-correction-policy.md` (create — the spike deliverable)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `src/content.config.ts`, `src/utils/blog.ts` — schema changes are the
  later build's job (LAW-F1 cross-repo contract).
- `PostLayout.astro`, `TrustPanel.astro`, dashboard.astro — no UI changes
  in a spike.
- `workers/` — no handler changes; the R2 sink stays as-is.
- `transparencia.md` — the ADR may propose wording, but policy pages are
  not edited in a spike.

## Git workflow

- Branch: `advisor/002-correction-policy-spike`
- Commit style: conventional (e.g. `docs: spike correction policy and moderation flow (plan 002)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`
on the unmodified checkout. **STOP and report** (command + exact output) if
any `declared` command is missing or fails here.

**Verify**: all three exit 0.

### Step 1: Confirm intake-without-output is still the reality

Run `grep -rni "correcci" src/components/ src/layouts/ src/pages/ | head -30`
and confirm: matches are form/policy prose only, no correction-display
component, no per-article history. Also confirm `dateModified` in
`PostLayout.astro:84` is JSON-LD-only (no rendered sibling).

**Verify**: no component renders a correction note today. If one already
exists, **STOP and report** — the premise changed.

### Step 2: Draft the correction taxonomy

Define 3 severity tiers (e.g. typo/ errata menor / corrección sustantiva /
note: keep to 3), each with: what qualifies, whether it updates the
rendered article vs. only a log entry, whether it bumps `dateModified`,
and one real-world example written for a science article. Rule of thumb to
encode: typo fixes are silent; anything that changes a claim, number, or
conclusion is public. Note the legal/editorial care boundary: wording must
correct without defaming sources; disputed science goes to
uncertainty-note treatment, not corrections.

**Verify**: taxonomy table drafted with all four columns filled per tier.

### Step 3: Draft the moderation flow from R2 sink to published correction

Trace the existing sink: R2 record shape in `workers/src/handlers/report.ts:75-80`
(`id`, `problem_type`, `article_url`, `description`, `content_snippet`, … —
read the full record before writing). Then specify: triage states, who
approves (human-in-the-loop is mandatory — no auto-publish from reports),
how approval reaches the frontend (two options priced: frontmatter
`corrections:` field via backend republication vs. a build-time corrections
sidecar file; recommend one, noting LAW-F1 schema implications of each),
and abuse handling (spam/harassment via this channel, rate-limit context
already in the handler).

**Verify**: flow names exact files/symbols on both ends (handler record
fields in, render location out). If the R2 record shape differs from this
plan's excerpt, **STOP and report** (drift).

### Step 4: Write `docs/adr/0010-correction-policy.md`

Follow `docs/adr/0000-adr-template.md` (Status: Proposed). Must contain:
taxonomy (Step 2), moderation flow (Step 3), UI sketch (correction note
placement adjacent to `TrustPanel` in `PostLayout.astro:215-223`, reusing
the `why_it_matters` callout style — ASCII sketch, no code), dashboard
observability note (report counts belong in `admin/dashboard.astro`'s
metrics next), explicit LAW-F1/LAW-F2 compliance section, proposed
`transparencia.md` wording diff (as quoted block, not applied), and max 3
open questions.

**Verify**: `npm run check:doc-drift` exits 0, `npm run test:audit`
passes, `git status --short` shows only the new ADR + `plans/README.md`.

## Test plan

No production code changes, no new unit tests. Safety:

- `npm run test:audit` → all pass.
- `npm run check:doc-drift` → exit 0.
- Cold-read test: an editor who has not seen this plan can state the 3
  tiers and the approval path from the ADR alone.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`, `npm run test:audit` all exit 0 / pass
- [ ] `docs/adr/0010-correction-policy.md` exists, follows the 0000 template, contains taxonomy + flow + UI sketch + LAW-F1/F2 section
- [ ] `git diff --name-only 8af478b...HEAD` lists only the new ADR and `plans/README.md`
- [ ] `plans/README.md` status row for 002 updated
- [ ] No report contents, emails, or PII reproduced in the ADR (field names only)

## STOP conditions

Stop and report (do not improvise) if:

- "Current state" excerpts don't match live code (drift).
- A correction-display surface already exists (premise answered).
- Verification fails twice after reasonable fix attempts.
- The design appears to require touching out-of-scope files to even specify.
- A `declared` command is missing/broken on the unmodified checkout.

## Maintenance notes

- The build plan will need backend coordination (republication path for
  corrections) — treat as cross-repo contract work per LAW-F1.
- Reviewer scrutiny: the silent-vs-public threshold; too low floods
  articles with noise, too high re-breaks the transparencia promise.
- **Deferred:** public corrections index page (`/correcciones/`) — worth
  doing only after per-article notes ship and volume justifies it.
- **Deferred:** reader notification (email/RSS) on corrected articles —
  needs plan 001's newsletter backend first.
