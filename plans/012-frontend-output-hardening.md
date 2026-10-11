# Plan 012: Harden frontend output sinks (link schemes, JSON-LD, consent)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a37798c..HEAD -- src/content.config.ts src/components/common/TrustPanel.astro src/layouts/template/Layout.astro src/components/ds/organisms/ConsentBannerScript.astro src/utils/browser/consent.ts tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a37798c`, 2026-10-11
- **Issue**: omit

## Why this matters

Three small output-safety gaps, each independently low-severity but all
cheap to close in one pass: (1) frontmatter link fields accept any URL
scheme and are rendered directly as anchors, so a `javascript:` value in
published frontmatter becomes click-activated script execution for every
reader; (2) the shared layout builds two JSON-LD blocks with raw
`JSON.stringify` while article/breadcrumb schemas already use the hardened
`serializeJsonLd` helper — a `</script>` sequence in site config breaks out
of the script block; (3) the consent banner casts a DOM dataset value to
`ConsentDecision` without validation while the reader side validates, so a
tampered value persists an unreadable consent payload. None changes
rendered output for legitimate content.

## Current state

Files and roles:

- `src/content.config.ts` — sealed post schema (LAW-F1). Today:
  - line 128: `sources[].url: z.url()` (any absolute URL, any scheme)
  - line 152: `reviewer_profile_url: z.url().optional()` (same)
- `src/components/common/TrustPanel.astro` — renders those fields as
  anchors (verified 2026-10-11):
  ```astro
  <!-- TrustPanel.astro:226-231, 271-280, 321-328 pattern -->
  <a
    href={reviewerProfileUrl}
    class="underline-offset-4 hover:underline"
    rel="noopener noreferrer"
    target="_blank"
  >
  ...
  <a
    href={source.url}
    ...
    rel="nofollow noopener noreferrer"
    target="_blank"
  ```
- `src/layouts/template/Layout.astro` — builds `organizationSchema` and
  `webSiteSchema` with raw `JSON.stringify` (lines 35–64) from
  config-controlled strings (`SITE.name`, `METADATA.description`, footer
  social URLs) and emits them via `set:html` (lines 75–76):
  ```astro
  <script is:inline type="application/ld+json" set:html={organizationSchema} />
  <script is:inline type="application/ld+json" set:html={webSiteSchema} />
  ```
  while article/breadcrumb schemas use the hardened `serializeJsonLd`
  helper (`PostLayout.astro:92`, `Breadcrumbs.astro`). The inconsistency is
  the finding; exploitability today needs operator-controlled config input.
- `src/components/ds/organisms/ConsentBannerScript.astro:21`:
  ```ts
  const decision = choice.dataset.consentChoice as ConsentDecision;
  writeConsent(decision);
  ```
  while `src/utils/browser/consent.ts` validates on read via `isDecision`
  (`readConsent` returns null for non-`granted|denied`) but `writeConsent`
  persists whatever string it receives. A tampered
  `data-consent-choice` value persists a payload the reader treats as null
  → banner permanently visible, analytics stuck in default-deny.

Repo conventions: `set:html` is allowed only for trusted pre-rendered
content (LAW-F7); the metadata path must stay shared (LAW-F2/F8). Backend
mirror: `news_collector/contracts/frontend_schema.py` has `source_url`
(`HttpUrl`) and `reviewer_profile_url` (`HttpUrl`) — pydantic `HttpUrl`
already constrains schemes, so the backend side needs no change; verify
that claim in Step 1 and if false, STOP and report (cross-repo contract
implication).

## Commands you will need

| Purpose   | Command                  | Provenance | Expected on success |
|-----------|--------------------------|------------|---------------------|
| Install   | `npm ci`                 | declared   | exit 0              |
| Lint      | `npm run lint`           | declared   | exit 0              |
| Content   | `npm run validate:content` | declared | exit 0              |
| Unit      | `npm run test:audit`     | declared   | all pass            |

## Scope

**In scope** (the only files you should modify):

- `src/content.config.ts` (scheme refinement on the two link fields)
- `src/layouts/template/Layout.astro` (use `serializeJsonLd` for both schemas)
- `src/components/ds/organisms/ConsentBannerScript.astro` (validate with `isDecision` before persist)
- `tests/content-config-schema.test.ts` or a new `tests/link-scheme.test.ts` (scheme tests)
- `tests/consent.test.ts` (guard test — check the file exists first; create if absent)

**Out of scope** (do NOT touch, even though they look related):

- Backend `frontend_schema.py` — read-only verification (Step 1). If it
  needs a change, STOP: that is a cross-repo contract change needing its
  own plan.
- `src/components/template/common/CommonMeta.astro` CSP
  (`script-src 'unsafe-inline'`) — larger project, explicitly deferred
  (see Maintenance notes).
- `TrustPanel.astro` markup — no change needed once the schema rejects bad schemes at build.
- Analytics event payload minimization (`search_term` to GA4) — tracked in
  plan 019, not here.

## Git workflow

- Branch: `advisor/012-output-hardening`
- Commit per step; e.g. `fix(security): allowlist http(s) schemes for frontmatter links`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

Run `npm ci` and `npm run test:audit` on the unmodified checkout.
Also verify the backend-mirror claim: read
`../noticiencias_news_collector/news_collector/contracts/frontend_schema.py`
`source_url`/`reviewer_profile_url` field types — expect pydantic `HttpUrl`
(which constrains schemes). If either is a plain `str`, STOP and report.

**Verify**: install + tests pass; backend fields are `HttpUrl`.

### Step 1: Allowlist URL schemes for frontmatter link fields

In `src/content.config.ts`, add a refinement rejecting non-`http:`/`https:`
schemes for `sources[].url` and `reviewer_profile_url` (fail the build
loudly — this must surface at `validate:content`, not render time).
Keep the refinement next to the field definitions. Note the file's
constraint: schema comments must live at module scope (the line-based
parser in `scripts/check-contract-sync.js` cannot skip `//` comments
inside the `z.object` body — see `content.config.ts:1-20`).

**Verify**: `npm run check:contract-sync` still passes (the refinement must
not confuse the line parser — if it does, restructure to keep the parser
green rather than editing the parser); a fixture post with
`url: "javascript:alert(1)"` fails `npm run validate:content`.

### Step 2: Route layout JSON-LD through serializeJsonLd

Replace the two raw `JSON.stringify` calls in
`src/layouts/template/Layout.astro` (organization + website schemas) with
the existing `serializeJsonLd` helper used by `PostLayout.astro:92`.
Import it from the same module the other call sites use. Output must be
byte-identical for normal config (verify by diffing build output).

**Verify**: `npm run build` exits 0; `git diff` of a freshly built
`dist/` JSON-LD block vs pre-change build shows no differences (compare
one article page + the homepage); `npm run test:dist` exits 0.

### Step 3: Guard the consent-choice cast

Export `isDecision` from `src/utils/browser/consent.ts` (if not already
exported) and early-return in the `ConsentBannerScript.astro` click
handler unless `choice.dataset.consentChoice` validates — log a warning
otherwise. Add a test in `tests/consent.test.ts` asserting a bogus
dataset value is rejected and never persisted.

**Verify**: `npx vitest run tests/consent.test.ts` passes, including the
new rejection case; full `npm run test:audit` passes.

### Step 4: Full check

Run `npm run lint && npm run validate:content`.

**Verify**: both exit 0.

## Test plan

- Scheme tests: `javascript:` and `data:` URLs rejected for both fields;
  `https:` accepted; missing optional `reviewer_profile_url` still valid.
  Model on `tests/content-config-schema.test.ts` if it exists, else create
  `tests/link-scheme.test.ts`.
- Consent test: bogus `data-consent-choice` value → handler returns early,
  storage untouched.
- Verification: named test files pass + full `npm run test:audit` passes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "javascript:" src/content.config.ts` — N/A; instead: fixture with `javascript:` URL fails `npm run validate:content` (prove by temp fixture, then delete it)
- [ ] `grep -n "JSON.stringify" src/layouts/template/Layout.astro` returns no matches
- [ ] `grep -n "as ConsentDecision" src/components/ds/organisms/ConsentBannerScript.astro` returns no matches
- [ ] `npm run lint` exits 0
- [ ] `npm run validate:content` exits 0
- [ ] `npm run test:audit` exits 0
- [ ] `git diff --name-only a37798c...HEAD` lists only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The backend mirror fields are not scheme-constrained (cross-repo implication).
- The scheme refinement breaks `npm run check:contract-sync` in a way that
  requires editing the parser (parser changes are out of scope).
- The JSON-LD serializer swap changes any built page's bytes for normal config.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- **Deferred:** removing `script-src 'unsafe-inline'` from the meta CSP
  (`CommonMeta.astro:20`) — needs per-build hashed inline scripts or
  edge-injected nonces via the Worker; a project, not a one-liner. Any
  future HTML-injection bug executes site-origin script until then.
- If new frontmatter link fields are added later, they must get the same
  scheme refinement — consider extracting a `zHTTPURL` helper when the
  third such field appears (two is not enough to abstract per LAW-F5).
