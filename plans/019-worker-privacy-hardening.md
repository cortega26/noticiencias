# Plan 019: Worker and analytics-privacy hardening (framing, CSP, evidence URLs, identity)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- workers/src/index.ts workers/src/handlers/report.ts workers/src/utils/validate.ts workers/src/utils/rateLimit.ts src/components/template/common/CommonMeta.astro src/components/common/SearchInterface.astro public/_headers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

The report-pipeline Worker is live in production (plan 023) with four
small gaps: no enforceable framing control (the meta CSP cannot carry
`frame-ancestors`, and Pages ignores `_headers` — the report form is
iframeable for clickjacking); `evidence_url` accepts `javascript:`/`data:`
URIs that persist to R2/email and may execute on some future surface; the
rate limiter trusts `CF-Connecting-IP` alone (spoofable direct-to-worker,
all headerless clients share one `'unknown'` bucket); and raw search terms
(which users fill with PII) ship to GA4 with no minimization. All are
small, additive, independently verifiable. The bigger `unsafe-inline`
removal stays deferred (see Maintenance).

## Current state

Facts (all verified 2026-10-11):

- `public/_headers:1-3` states headers are not applied on GitHub Pages;
  `CommonMeta.astro:18-21` carries the CSP as a `<meta>` tag (full content
  verified — includes `script-src 'self' 'unsafe-inline' ...`, `form-action
'self' https://buttondown.com`). `frame-ancestors` in meta CSP is ignored
  by browsers; `X-Frame-Options` via meta is unsupported → no clickjacking
  control is enforced (notably over `src/pages/reportar-problema.astro`).
  The Worker (`workers/src/index.ts`) already rewrites responses
  (passthrough) — the edge injection point.
- `workers/src/utils/validate.ts:126-134` — `evidence_url` needs only
  `new URL()` to parse (no scheme check), unlike `article_url` which is
  host-restricted (`:108-119`). Values persist to R2 and email
  (`workers/src/handlers/report.ts:75-88, :204-217`).
- `workers/src/handlers/report.ts:23`:
  `request.headers.get('CF-Connecting-IP') || 'unknown'` is the limiter key
  (`workers/src/utils/rateLimit.ts:22-37`, key
  `ratelimit:${clientIp}:${windowBucket}`, KV-backed).
- `src/components/common/SearchInterface.astro:159`:
  `trackEvent('search', { search_term: query.trim(), results_count: results.length })`.
- `docs/DEPLOYMENT_SECURITY_HEADERS.md` + `tests/compliance.test.ts` keep
  meta/`_headers`/edge-rule in sync — any header change must update all
  three sides of that contract.

Repo conventions: Worker has its own `workers/package.json` (`typecheck`,
`test:coverage` scripts); compliance test guards header sync; no secrets
in code (report R2/email paths already audited clean).

## Commands you will need

| Purpose      | Command                                   | Provenance | Expected on success |
| ------------ | ----------------------------------------- | ---------- | ------------------- |
| Install      | `npm ci` (root)                           | declared   | exit 0              |
| Worker type  | `npm --prefix workers run typecheck`      | declared   | exit 0              |
| Worker tests | `npm --prefix workers run test:coverage`  | declared   | pass                |
| Compliance   | `npx vitest run tests/compliance.test.ts` | declared   | pass                |
| Lint         | `npm run lint`                            | declared   | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `workers/src/index.ts` (edge framing headers on HTML responses)
- `workers/src/utils/validate.ts` (evidence_url scheme allowlist)
- `workers/src/utils/rateLimit.ts` + `workers/src/handlers/report.ts`
  (trusted-identity resolution, `'unknown'` bucket isolation)
- `src/components/common/SearchInterface.astro` (drop/hash search_term)
- `docs/DEPLOYMENT_SECURITY_HEADERS.md` (document the meta/edge split)
- Worker + compliance tests

**Out of scope** (do NOT touch, even though they look related):

- Removing `'unsafe-inline'` from `script-src` — deferred project (hashed
  inline scripts or edge nonces); keep the meta tag as fallback.
- Report pipeline storage/email logic — untouched.
- `public/_headers` semantics on Pages — document, don't fight.

## Git workflow

- Branch: `advisor/019-worker-privacy`
- Commit per item; e.g. `fix(worker): enforce framing headers at the edge`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run the worker typecheck + tests and the compliance test on the unmodified
checkout.

**Verify**: all green; you know the header-sync contract's current shape.

### Step 1: Enforce framing at the edge

Have the Worker set `X-Frame-Options: SAMEORIGIN` (and/or
`frame-ancestors 'self'`) on HTML responses. Keep the meta tag as fallback
and document the split in `docs/DEPLOYMENT_SECURITY_HEADERS.md`. Update
`tests/compliance.test.ts` expectations if it enumerates enforced headers.

**Verify**: worker tests pass; compliance test passes; same-origin framing
preserved (only third-party embedding breaks — assert no same-origin
embed in the repo breaks by grepping for `<iframe` usages of site pages).

### Step 2: Allowlist evidence_url schemes

Reject non-`http:`/`https:` schemes for `evidence_url` in
`validateReportPayload`, alongside the existing URL-validity test. Add
worker tests (`javascript:`/`data:` rejected, `https:` accepted).

**Verify**: worker `test:coverage` passes with the new cases.

### Step 3: Harden rate-limit identity

Resolve client identity from the platform's trusted connection metadata
first; treat `CF-Connecting-IP` as an untrusted hint (fallback only behind
the CDN); give unidentified (`'unknown'`) clients a stricter shared bucket
so one headerless flood cannot borrow the normal budget.

**Verify**: worker tests pass, including a direct-request (no header) case
and a spoofed-header case asserting the trusted source wins.

### Step 4: Minimize search analytics

Stop sending raw `search_term` (send a length bucket or omit it; keep
`results_count`). Document the retained analytics fields where the consent
path documents analytics (`src/utils/browser/consent.ts` vicinity or the
analytics doc — find the existing spot, don't create a competing doc).

**Verify**: `grep -n "search_term" src/components/common/SearchInterface.astro`
returns no matches; `test:audit` passes.

## Test plan

- Worker tests: evidence-scheme rejection (2 cases), rate-limit identity
  (trusted-beats-spoofed, unknown-bucket isolation).
- Compliance test updated for the new edge headers.
- Search: assert the emitted event payload shape (no raw term).
- Verification: worker `test:coverage` + root `test:audit` + compliance all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm --prefix workers run typecheck` exits 0
- [ ] `npm --prefix workers run test:coverage` passes (incl. ≥4 new tests)
- [ ] `npx vitest run tests/compliance.test.ts` passes
- [ ] `grep -n "new URL(evidenceUrl)" workers/src/utils/validate.ts` is accompanied by a scheme check in the same block
- [ ] `grep -n "search_term" src/components/common/SearchInterface.astro` returns no matches
- [ ] `npm run lint` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The Worker cannot set headers on the Pages responses in its passthrough
  position (architecture assumption false — report, don't re-architect).
- The compliance test's header contract contradicts the edge approach
  (reconcile in the doc first; don't weaken the test to pass).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- **Deferred:** `script-src 'unsafe-inline'` removal (per-build hashed
  scripts or edge nonces). Until then, any HTML-injection bug is full
  origin compromise — treat every new `set:html`/inline script as
  security-sensitive in review.
- If the report form ever renders `evidence_url` as a link anywhere
  (email template, admin view), the scheme allowlist is the backstop —
  keep it.
