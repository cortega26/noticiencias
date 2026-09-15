# Plan 006: Spike social-distribution graduation from gated pilot to operated channel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- .github/workflows/social-distribution.yml scripts/social/ src/pages/social-manifest.json.ts src/pages/admin/dashboard.astro src/content.config.ts docs/adr/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (valuable reach, but enabling automation without observability repeats the plan-002 mistake — an invisible sink)
- **Effort**: M (spike: enablement checklist + coverage gap + observability sketch as ADR draft)
- **Risk**: LOW (spike only; the flag stays off and no publisher code changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The hard infrastructure already shipped across seven packages (eligibility,
deterministic copy, HTTP transport, ledger with CAS, Bluesky + Buffer
adapters, gated workflow): the publisher is a tested pilot with the parking
brake on. The remaining work is operational, not architectural — who decides
the flag flips, what networks are actually covered, and who notices a failed
publish. Flipping `SOCIAL_PUBLISH_ENABLED` without those answers risks
public automation failures with no one watching; this spike writes the
answers down. It does NOT enable publishing or change publisher code.

## Current state

The facts the executor needs, inlined:

- Gate: `.github/workflows/social-distribution.yml:1-7,71-83` — "Disabled
  by default: the publish job only runs when the repository variable
  `SOCIAL_PUBLISH_ENABLED == 'true'`. Otherwise only the read-only dry-run
  job runs (zero mutations, no provider writes, no ledger writes)."
  Triggers: successful `Deploy to GitHub Pages` on main, or manual
  `workflow_dispatch` with `mode=publish` (which still requires the flag).
- Providers: `scripts/social/providers/` contains exactly `bluesky.js`
  (direct ATProto adapter) and `buffer.js` (Buffer adapter). The workflow
  already passes `BUFFER_X_CHANNEL_ID`, `BUFFER_FACEBOOK_CHANNEL_ID`,
  `BUFFER_LINKEDIN_CHANNEL_ID` vars (lines 63-66) — so X/FB/LinkedIn ride
  via Buffer, Bluesky is direct. Coverage gap to assess: anything the
  audience needs that neither covers (e.g. Instagram visual cards,
  Mastodon/ActivityPub, WhatsApp/Telegram channels for ES audiences).
- Secrets involved (names only — never values): `BUFFER_API_KEY`,
  `BLUESKY_APP_PASSWORD` (`social-distribution.yml:105-106`). The ADR must
  name rotation expectations, not values.
- Operational snapshot exists: `src/pages/social-manifest.json.ts` builds
  `/social-manifest.json` (schema_version 1, per-article normalized
  `social` config + build provenance, null outside the deploy workflow),
  excluded from the sitemap, asserted by `scripts/dist-sanity.js`.
  Frontmatter opt-in: `social: { publish, id }` (`src/content.config.ts:92-98`,
  strict, 64-hex id required when publishing).
- Observability gap: `src/pages/admin/dashboard.astro` shows content/image
  metrics from `data/metrics/pipeline-metrics.json` with zero social
  surface (verified: no social/newsletter/report references). Publisher
  state lives on the `social-state` branch (`docs/ARCHITECTURE.md`), i.e.
  outside every dashboard the operator looks at.
- Quality bar precedent: recent social PRs (`6ee274b` execute-mode mapping
  fix, `b4b6f9`-era review catches) show this area earns its caution —
  automation bugs here are public by definition.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Baseline lint | `npm run lint` | declared | exit 0 |
| Baseline content validation | `npm run validate:content` | declared | exit 0 |
| Doc-drift gate | `npm run check:doc-drift` | declared | exit 0 |
| Audit suite | `npm run test:audit` | declared | all pass (note: `tests/social/` exists — run it unmodified as part of the suite) |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor. Broken on unmodified checkout → STOP, report, don't fix.

## Scope

**In scope** (the only files you should modify):
- `docs/adr/0012-social-graduation.md` (create — the spike deliverable)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):
- `.github/workflows/social-distribution.yml` — the flag stays off; no
  trigger/permission changes in a spike.
- `scripts/social/*` — no adapter or publisher changes.
- `src/content.config.ts` — no `social` contract changes (LAW-F1).
- `admin/dashboard.astro` — sketch the observability, don't build it.
- Any secret creation, rotation execution, or channel provisioning — names
  and procedures only, zero credential values.

## Git workflow

- Branch: `advisor/006-social-graduation-spike`
- Commit style: conventional (e.g. `docs: spike social graduation readiness (plan 006)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`
unmodified. **STOP and report** (command + output) on any failure.

**Verify**: all three exit 0.

### Step 1: Confirm the pilot is still gated

**Verify**: `grep -n "SOCIAL_PUBLISH_ENABLED" .github/workflows/social-distribution.yml`
shows the dry-run default + publish gate, and `ls scripts/social/providers/`
shows the same two adapters. If the flag is on in the repo (it lives in
repo vars, not code — note that honestly) or a third adapter exists,
**STOP and report** — premise shifted.

### Step 2: Write the enablement checklist

Define flip criteria as checkable items: dry-run streak (e.g. N consecutive
clean dry-runs on real deploys), `social: {publish, id}` coverage on recent
posts (query: how many v2 posts carry opt-in today?), secret provisioning +
rotation procedure (names only), rollback (flag off + ledger reconcile via
existing `reconcile` mode — verify that mode exists in
`scripts/social/operate.js` before citing it), and who owns the flag
(single human, named role not person). Include a "first-publish" plan:
manual dispatch, one article, business-hours monitoring.

**Verify**: every checklist item is verifiable by a named command, file, or
workflow run — no "ensure quality" prose items.

### Step 3: Assess the network-coverage gap

Map current reach (Bluesky direct; X/FB/LinkedIn via Buffer vars) against
where a Spanish-language science audience plausibly is; name at most 2
candidate additions with cost (Buffer already paid? new adapter = new
secrets + new failure modes) and explicitly recommend doing or deferring
each. Default stance: no new adapter before graduation — justify any
exception.

**Verify**: gap table with cost + verdict per candidate network.

### Step 4: Sketch dashboard observability

Specify what `admin/dashboard.astro` should show once graduated (last
publish status per network, ledger head vs manifest, failed-publish alert
path), reading from which sources (social-state branch? manifest?
workflow conclusions?), without building it. Reuse the existing
`DashboardMetrics`/`DashboardHealthList` organism pattern already composed
in that file.

**Verify**: sketch names exact components and data sources; no code written.

### Step 5: Write `docs/adr/0012-social-graduation.md`

Follow `docs/adr/0000-adr-template.md` (Status: Proposed): Context (pilot
state + this plan's evidence), Decision (graduate with checklist / stay
gated — recommend one), Consequences (ops load, reputation surface),
Alternatives (stay gated vs. graduate vs. graduate-with-reduced-networks),
plus checklist (Step 2), gap verdicts (Step 3), observability sketch
(Step 4), secret-hygiene note (names only + rotation), max 3 open questions.

**Verify**: `npm run check:doc-drift` exits 0, `npm run test:audit`
passes, `git status --short` shows only the new ADR + `plans/README.md`.

## Test plan

No production code changes, no new unit tests.

- `npm run test:audit` → all pass, including existing `tests/social/`.
- `npm run check:doc-drift` → exit 0.
- Cold-read test: the flag owner can execute the first-publish plan from
  the ADR without asking a procedural question.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`, `npm run test:audit` all exit 0 / pass
- [ ] `docs/adr/0012-social-graduation.md` exists, follows the 0000 template, contains checkable enablement checklist + gap verdicts + observability sketch
- [ ] `git diff --name-only 8af478b...HEAD` lists only the new ADR and `plans/README.md`
- [ ] `plans/README.md` status row for 006 updated
- [ ] No secret values, tokens, passwords, or channel IDs anywhere in the new file (names only)

## STOP conditions

Stop and report (do not improvise) if:

- "Current state" excerpts don't match live code (drift).
- Publishing is already enabled or a new adapter exists (premise shifted).
- The `reconcile` mode cited for rollback doesn't exist in `scripts/social/operate.js`.
- Verification fails twice after reasonable fix attempts.
- Graduation spec appears to need out-of-scope edits.
- A `declared` command is missing/broken on the unmodified checkout.
- Any step would require provisioning secrets or touching credentials.

## Maintenance notes

- The flag flip itself is a one-line repo-var change with outsized blast
  radius — the checklist (not the diff) is the review artifact.
- Reviewer scrutiny: Buffer as single point of failure for 3 networks;
  direct-vs-Buffer trade-off per network belongs in the ADR's alternatives.
- **Deferred:** new network adapters — only after graduation proves stable
  for one full publishing month.
- **Deferred:** per-article social performance feedback into curation
  (which topics travel?) — needs plan 003 analytics + graduated publishing
  both live.
