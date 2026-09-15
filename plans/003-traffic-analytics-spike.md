# Plan 003: Spike privacy-preserving traffic metrics to unblock data-driven decisions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- src/config.yaml src/components/template/common/Analytics.astro src/components/template/common/CommonMeta.astro src/integration/utils/configBuilder.ts src/pages/transparencia.md src/pages/privacidad.md src/pages/admin/dashboard.astro docs/adr/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (unblocks sequencing of plans 004/005 and the deferred ADR-0008 routing call, but nothing is broken today)
- **Effort**: S–M (spike: provider comparison + consent/CSP plan as ADR draft)
- **Risk**: LOW (one ADR draft file only; analytics stays off)
- **Depends on**: none (soft: plans 004/005 sequence better with its answer, but are not blocked on it)
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The site currently flies blind: homepage curation (`hub.ts` featured/context
selection), the 150KB search-artifact budget, and the Cloudflare Worker
catch-all route's cost are all decided without any traffic signal, and the
transparency page's promised "informes periódicos sobre crecimiento" cannot
exist. ADR-0008 explicitly deferred its biggest operational call (Worker
invocation headroom on the Free plan) until analytics are wired up. This
spike picks the privacy-compatible way to get that signal. It does NOT
enable any tracking.

## Current state

The facts the executor needs, inlined:

- `src/config.yaml:71-74`: analytics is a configured null:

  ```yaml
  analytics:
    vendors:
      googleAnalytics:
        id: null # or "G-XXXXXXXXXX"
  ```

- `src/components/template/common/Analytics.astro:4-5` renders nothing
  without a valid ID:

  ```text
  const gaId = ANALYTICS?.vendors?.googleAnalytics?.id;
  const isEnabled = gaId && gaId !== 'null' && String(gaId).startsWith('G-');
  ```

  Config plumbing (`src/integration/utils/configBuilder.ts:128-135`) merges
  `config.analytics` over defaults, so any future vendor only needs config
  - component support.

- CSP already anticipates a decision either way
  (`src/components/template/common/CommonMeta.astro:9-12`): `script-src`
  and `connect-src` allowlist `googletagmanager.com`/`google-analytics.com`.
  A non-Google vendor requires editing exactly this header (and removing or
  keeping the Google entries deliberately — no dead allowlist entries).
- Promises constraining the pick:
  - `src/pages/transparencia.md:23`: "No almacenamos datos personales de
    visitantes en prompts. Solo usamos métricas agregadas sin PII."
  - `src/pages/transparencia.md:27`: "Publicaremos informes periódicos
    sobre crecimiento y sostenibilidad cuando estén disponibles."
  - `src/pages/privacidad.md:47-57`: defines Datos de Uso (IP, browser,
    pages, timestamps) and cookie tracking disclosure — any vendor must fit
    inside what this page already discloses, or the ADR must list the page
    update as a required follow-up (not make it).
- ADR-0008's deferred call (quote for the ADR): Free-plan budget is
  "100,000 Worker-invocations/day", realistic amplification "~5-15 requests"
  per pageview, "Revisit only if real traffic data (once GA4/GSC are wired
  up) shows this materially matters". This spike is that wiring decision.
- LAW-F8 (`AGENTS.md`): performance is a first-class constraint — vendor
  script weight and its effect on Core Web Vitals must be scored, not
  assumed.

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

- `docs/adr/0011-traffic-analytics.md` (create — the spike deliverable)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `src/config.yaml`, `Analytics.astro`, `CommonMeta.astro` — enabling or
  rewiring vendors is the later build's job.
- `privacidad.md`, `transparencia.md` — propose wording, don't edit policy.
- Any vendor account, tracking ID, or snippet installation. No measurement
  IDs or secrets anywhere in the ADR.

## Git workflow

- Branch: `advisor/003-traffic-analytics-spike`
- Commit style: conventional (e.g. `docs: spike traffic analytics decision (plan 003)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`
unmodified. **STOP and report** (command + output) on any failure.

**Verify**: all three exit 0.

### Step 1: Confirm analytics is still off

**Verify**: `grep -n "id:" src/config.yaml | head -5` shows the GA id
still `null`, and `Analytics.astro` still gates on `startsWith('G-')`. If an
ID is now configured, **STOP and report** — premise answered.

### Step 2: Compare GA4 vs privacy-first vendors against six criteria

Score Google Analytics 4, Plausible, and Cloudflare Web Analytics (all three;
substitute Umami only if one proves technically incompatible with static
Astro + GitHub Pages, and say so) on:

1. PII posture vs `transparencia.md:23` (cookies? IP storage? fingerprinting?).
2. Consent-banner requirement under the site's own privacidad.md (Chile) —
   does the vendor need a banner the site doesn't have?
3. Script weight + loading pattern vs LAW-F8 (bytes, defer/async, effect on LCP/INP).
4. CSP delta: exact `CommonMeta.astro:11` entries to add/remove per vendor.
5. Cost at the site's scale + data retention limits.
6. Whether it answers ADR-0008's deferred question (per-path request counts
   sufficient to evaluate Worker-route headroom — pageview-only tools may
   not suffice; say so explicitly).

**Verify**: comparison table with all six rows × three vendors drafted (becomes the ADR Alternatives table).

### Step 3: Specify the integration sketch for the winner

Without implementing: which files the build plan touches (`src/config.yaml`
shape, `Analytics.astro` branch or new component following its
`isEnabled` pattern, `CommonMeta.astro` header entries), how Search Console
(or equivalent) fits alongside, what the first "informe periódico" (per
transparencia.md:27) contains and where it lives, and how dashboard
(`admin/dashboard.astro`) surfaces the numbers next.

**Verify**: sketch names exact files/symbols; no code written.

### Step 4: Write `docs/adr/0011-traffic-analytics.md`

Follow `docs/adr/0000-adr-template.md` (Status: Proposed): Context (include
the ADR-0008 deferred-quote), Decision (one vendor), Consequences
(including "what becomes harder": e.g. funnel depth if privacy-first wins),
Alternatives table (Step 2), integration sketch (Step 3), required
`privacidad.md`/`transparencia.md` follow-ups listed (not made), max 3 open
questions.

**Verify**: `npm run check:doc-drift` exits 0, `npm run test:audit`
passes, `git status --short` shows only the new ADR + `plans/README.md`.

## Test plan

No production code changes, no new unit tests.

- `npm run test:audit` → all pass.
- `npm run check:doc-drift` → exit 0.
- Cold-read test: maintainer can approve/reject the vendor from the Alternatives table alone.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run check:doc-drift`, `npm run test:audit` all exit 0 / pass
- [ ] `docs/adr/0011-traffic-analytics.md` exists, follows the 0000 template, scores 3 vendors × 6 criteria, answers whether the winner serves ADR-0008's deferred question
- [ ] `git diff --name-only 8af478b...HEAD` lists only the new ADR and `plans/README.md`
- [ ] `plans/README.md` status row for 003 updated
- [ ] No measurement IDs, API keys, or account identifiers anywhere in the new file

## STOP conditions

Stop and report (do not improvise) if:

- "Current state" excerpts don't match live code (drift).
- Analytics is already enabled (premise answered).
- Verification fails twice after reasonable fix attempts.
- Specifying the pick requires touching out-of-scope files.
- A `declared` command is missing/broken on the unmodified checkout.
- Evaluation would need a vendor account or live snippet — public docs only.

## Maintenance notes

- Plans 004 (series) and 005 (recursos) sequence better once traffic data
  exists (which sections get read?) — soft dependency, not a gate.
- Reviewer scrutiny: the transparencia.md:23 tension — if the winner stores
  anything PII-adjacent, the policy update is part of the build, not optional.
- **Deferred:** first periodic growth report — needs the vendor live for one
  full reporting period; spec its outline only.
- **Deferred:** Worker-route exclusion revisit (ADR-0008) — needs real
  per-path numbers; this spike only makes them obtainable.
