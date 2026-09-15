# Plan 007: Build the Cloudflare Web Analytics integration (disabled by default)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 907bf50..HEAD -- src/config.yaml src/components/template/common/Analytics.astro src/components/template/common/CommonMeta.astro src/integration/utils/configBuilder.ts src/types/config.ts src/layouts/template/Layout.astro src/pages/privacidad.md src/pages/transparencia.md docs/adr/0011-traffic-analytics.md tests/config-builder.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (first build of the direction backlog; unblocks measurement for everything else)
- **Effort**: S
- **Risk**: LOW (additive code, ships disabled; no user-visible change until a token is configured)
- **Depends on**: ADR-0011 `Accepted` (maintainer flips `Proposed` → `Accepted`; verify in Step 0 — STOP otherwise). Soft: plan 003 DONE (it is; the full spec is also inlined below so this plan survives even if the ADR file is absent).
- **Category**: direction-build
- **Planned at**: commit `907bf50`, 2026-09-15

## Why this matters

ADR-0011 chose Cloudflare Web Analytics but enabled nothing. This build lands
the integration so that switching analytics on later is a config value, not
a project: vendor config plumbing, the beacon component behind the existing
`isEnabled`-style gate, the exact CSP delta, the promised policy wording,
and tests proving the off-state stays off. Tracking stays OFF when this
merges (token `null`) — enablement is a separate operator step gated on the
ADR's open question 2 (legal sign-off on the no-banner position).

## Current state

The facts the executor needs, inlined (re-verify each in Step 1):

- `src/config.yaml:71-74`:

  ```yaml
  analytics:
    vendors:
      googleAnalytics:
        id: null # or "G-XXXXXXXXXX"
  ```

- `src/components/template/common/Analytics.astro:1-9` (full gate logic):

  ```astro
  ---
  import { ANALYTICS } from 'astrowind:config';

  const gaId = ANALYTICS?.vendors?.googleAnalytics?.id;
  const isEnabled = gaId && gaId !== 'null' && String(gaId).startsWith('G-');
  const partytown = ANALYTICS?.vendors?.googleAnalytics?.partytown;
  const attrs = partytown ? { type: 'text/partytown' } : {};
  const id = String(gaId);
  ---
  ```

  Mount point: `src/layouts/template/Layout.astro:12,76` (`import Analytics`
  - `<Analytics />`); `src/layouts/BaseLayout.astro:2,27` wraps the template
    layout — so the component renders site-wide. No per-page wiring needed.

- `src/integration/utils/configBuilder.ts:125-136`:

  ```ts
  const getAnalytics = (config: Config): AnalyticsConfig => {
    const _default = {
      vendors: {
        googleAnalytics: {
          id: undefined,
          partytown: true,
        },
      },
    };

    return merge({}, _default, config.analytics ?? {}) as AnalyticsConfig;
  };
  ```

  Type mirror: `src/types/config.ts:65+` (`googleAnalytics: {...}` block —
  read it before editing; extend with the new vendor, same optional style).

- CSP: `src/components/template/common/CommonMeta.astro:9-12` — `script-src`
  and `connect-src` currently allowlist Google hosts only.

- Spec (inlined from ADR-0011, executor commits `00f0b50`/`714caa9`
  worktrees; authoritative if the ADR file is not on your checkout):
  vendor = Cloudflare Web Analytics beacon
  (`https://static.cloudflareinsights.com/beacon.min.js`); beacon data goes
  to own-domain `/cdn-cgi/rum` when the site is proxied (it is — Cloudflare
  fronts the zone per ADR-0008) else `https://cloudflareinsights.com/cdn-cgi/rum`;
  NO Partytown (module/RUM script, not gtag — say why inline); Search
  Console stays a separate manual source; dashboard surfacing is a later
  manual-paste step, not this build. Confirm the exact snippet shape against
  current official Cloudflare docs at build time (it has changed before);
  never invent attributes.

- Test patterns: `tests/config-builder.test.ts` (has an "explicit form
  endpoint overrides the empty default" case — mirror it); component tests
  under `tests/component/` are pure-logic only (no Astro render harness —
  do NOT try to render `.astro` in vitest); `scripts/dist-sanity.js` is the
  dist-assertion precedent (run via `npm run test:dist`).

## Commands you will need

| Purpose                     | Command                    | Provenance | Expected on success     |
| --------------------------- | -------------------------- | ---------- | ----------------------- |
| Baseline lint               | `npm run lint`             | declared   | exit 0                  |
| Baseline content validation | `npm run validate:content` | declared   | exit 0                  |
| Full build                  | `npm run build`            | declared   | exit 0, `dist/` emitted |
| Dist sanity                 | `npm run test:dist`        | declared   | exit 0                  |
| Audit suite                 | `npm run test:audit`       | declared   | all pass                |
| Doc-drift gate              | `npm run check:doc-drift`  | declared   | exit 0                  |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor on this plan. Broken on unmodified checkout → STOP (Step 0).

## Scope

**In scope** (the only files you should modify):

- `src/config.yaml` (add `analytics.vendors.cloudflare: { token: null }` + comment)
- `src/integration/utils/configBuilder.ts` (default for the new vendor)
- `src/types/config.ts` (type mirror)
- `src/components/template/common/Analytics.astro` (beacon behind token gate)
- `src/components/template/common/CommonMeta.astro` (CSP delta only)
- `src/pages/privacidad.md`, `src/pages/transparencia.md` (ADR-proposed wording, adapted to Spanish)
- `tests/config-builder.test.ts` (extend: cloudflare default + override cases)
- Active docs touched by the doc-drift gate because of the above (only what `npm run check:doc-drift` demands)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- Filling a real token / enabling tracking — token stays `null`; enablement is a later operator step after legal Q2.
- `src/layouts/*` — mount point already exists; no layout changes.
- Dashboard (`admin/dashboard.astro`) — manual-paste surfacing is explicitly deferred.
- Any vendor account, snippet auto-injection settings, or DNS changes.
- New dependencies.

## Git workflow

- Branch: `advisor/007-analytics-build`
- Commit style: conventional (e.g. `feat(analytics): Cloudflare Web Analytics integration, disabled by default (plan 007)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline + gates

1. Run the plan's drift check. On mismatch vs "Current state": STOP.
2. Confirm `docs/adr/0011-traffic-analytics.md` exists with `Status: Accepted`.
   If `Proposed` or absent: STOP (maintainer decision pending). The inlined
   spec above does NOT substitute acceptance.
3. Run `npm run lint`, `npm run validate:content` unmodified; record
   `git rev-parse --short HEAD` as `<start-SHA>`.

**Verify**: drift empty (or STOP-worthy and reported); ADR Accepted;
baseline green; `<start-SHA>` recorded.

### Step 1: Resolve the beacon-delivery variant (ADR open question 1)

Check the live production response headers for `Cache-Control` (Cloudflare
docs: auto-injection fails under `public, no-transform`) and confirm the
zone is proxied (per ADR-0008 it is). Decide: manual snippet (expected) vs
auto-injection. Record the decision + evidence (header values) in your
working notes; the snippet shape in Step 3 must match the chosen variant.

**Verify**: decision recorded with header evidence. If headers are
unreachable from your environment, use the manual-snippet default, say so
in the ADR-neutral commit message, and flag it in your report — do not
treat the default as verified.

### Step 2: Config plumbing + types

Add `cloudflare: { token: null }` under `analytics.vendors` in
`src/config.yaml` (comment: stays null until legal Q2 clears enablement),
default `cloudflare: { token: undefined }` in `getAnalytics`, and the type
mirror in `src/types/config.ts` (same optional style as `googleAnalytics`).

**Verify**: `npm run check:doc-drift` exits 0 (fix repeater docs in the same
change if it flags the new block); `npx astro check` shows no new type errors
(runs inside `validate:content` — or run it directly on failure).

### Step 3: Beacon component behind the gate

Extend `Analytics.astro` with a second gated branch: render the
Cloudflare beacon `<script>` ONLY when a non-empty token is configured
(mirror the existing `isEnabled` pattern; no Partytown attrs — add an
inline comment: module/RUM script, Partytown is gtag-only). Confirm exact
snippet attributes against current official Cloudflare docs; never invent
`data-cf-beacon` shape from memory.

**Verify**: with token `null` (committed state), built HTML contains no
`cloudflareinsights` string (see Step 5). Presence-path check: locally and
temporarily set a `TEST-TOKEN-PLACEHOLDER`, rebuild, grep dist for the
beacon, then revert — the placeholder must never be committed (prove with
`git diff` showing no config change + a final dist rebuild from clean state).

### Step 4: CSP delta

Per the Step 1 variant: always add `script-src https://static.cloudflareinsights.com`;
for `connect-src`, use `'self'` only if data goes to own-domain `/cdn-cgi/rum`
(expected when proxied), else add `https://cloudflareinsights.com`. Remove
nothing Google (GA branch still exists). State the chosen variant inline as
a comment so the next reader knows why.

**Verify**: header string copied verbatim into your report; `npm run lint`
(format + drift) green.

### Step 5: Policy wording + tests + full gates

1. Apply the ADR's proposed `privacidad.md` (provider + Datos de Uso +
   no-banner position, flagged as pending legal confirmation — the text
   must say the beacon is NOT YET active) and `transparencia.md` (activate
   the "cuando estén disponibles" clause as "pendiente de activación", NOT
   as live reporting) wording, adapted to Spanish.
2. Extend `tests/config-builder.test.ts`: cloudflare token defaults to
   `undefined`; explicit token override merges without dropping
   `googleAnalytics` defaults.
3. Run in order: `npm run lint`, `npm run validate:content`,
   `npm run build`, `npm run test:dist`, `npm run test:audit`.

**Verify**: all green; `grep -r "cloudflareinsights" dist/ | head` returns
nothing on the committed (token-null) build; new tests pass
(`npx vitest run tests/config-builder.test.ts`).

## Test plan

- New/extend tests in `tests/config-builder.test.ts` (pattern: the existing
  "explicit form endpoint overrides the empty default" case): default
  cloudflare token undefined; override merges; GA defaults preserved.
- Dist assertions (Step 5.3): beacon absent when disabled; `test:dist` green.
- No `.astro` render tests (no harness exists — see Current state).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run build`, `npm run test:dist`, `npm run test:audit` all exit 0 / pass
- [ ] `grep -r "cloudflareinsights" dist/` empty on the committed-state build
- [ ] New config-builder tests exist and pass
- [ ] No real token, measurement ID, or account identifier anywhere (`grep -rniE "G-[A-Z0-9]{6,}|cf-.*token|api[_-]?key" src/ docs/ tests/` shows only benign prose)
- [ ] Token in committed `src/config.yaml` is `null`
- [ ] `git diff --name-only <start-SHA>...HEAD` lists only in-scope files
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report (do not improvise) if:

- Drift vs "Current state" excerpts.
- ADR-0011 is not `Accepted`.
- The beacon snippet shape cannot be confirmed from current official docs.
- Any step needs a real token, account access, or DNS change.
- A step's verification fails twice after reasonable fix attempts.
- The change appears to require touching an out-of-scope file.
- A `declared` command is missing/broken on the unmodified checkout.

## Maintenance notes

- Enablement (filling the token) is a separate operator change gated on
  legal Q2 + the first-informe workflow — it must update `transparencia.md`
  from "pendiente" to live in the same change.
- If Cloudflare changes the snippet shape, only `Analytics.astro` + this
  plan's Step 3 notes need revisiting.
- Reviewer scrutiny: the `connect-src` variant choice and its inline
  justification; any `script-src` addition beyond `static.cloudflareinsights.com`.
- **Deferred:** dashboard surfacing (manual paste first, per ADR) — needs the token live + one reporting period.
- **Deferred:** Worker-route exclusion revisit (ADR-0008) — needs real per-path numbers post-enablement.
