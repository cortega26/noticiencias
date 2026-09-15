# Plan 001: Spike a newsletter backend to honor the promised Boletín Semanal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8af478b..HEAD -- src/config.yaml src/components/common/NewsletterCapture.astro src/pages/newsletter.astro src/pages/recursos/detector-de-hype.md src/pages/privacidad.md src/pages/transparencia.md src/components/common/DailyDesk.astro docs/adr/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (spike: investigation + ADR draft; the later build is a separate L)
- **Risk**: LOW (this plan writes one ADR draft file only; no production behavior changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8af478b`, 2026-09-15

## Why this matters

The site promises a weekly email newsletter in at least three reader-facing
places but captures zero emails: the subscribe form renders as RSS/archive
fallback links because no backend endpoint exists. Every week this stays a
stub, the methodology and trust pages' credibility erodes — the product
claims an editorial rhythm ("Cada viernes enviamos Noticiencias Semanal")
it does not operate. This spike does NOT build the newsletter; it produces
the decision (provider + wire contract + privacy/ops plan) a later build
plan can execute without guesswork.

## Current state

The facts the executor needs, inlined:

- `src/config.yaml:76-85` — the newsletter endpoint is deliberately empty,
  separate from the report endpoint:

  ```yaml
  form:
    endpoint: 'https://noticiencias.com/api/report'
    # Newsletter capture endpoint — deliberately separate from the report
    # endpoint (the two forms have different wire contracts). Stays empty
    # until a newsletter backend exists; the page then shows RSS/blog
    # alternatives instead of a form that would POST to /api/report.
    newsletter_endpoint: ''
  ```

- `src/components/common/NewsletterCapture.astro:18-19,55-70` — empty
  endpoint means the form never renders; readers get fallback links:

  ```text
  const endpoint = APP_CONFIG?.form?.newsletter_endpoint || '';
  const isEnabled = endpoint.length > 0;
  ---
  {isEnabled ? (
      <form action={endpoint} method="post" ...> ... </form>
    ) : (
      <div class="flex flex-wrap gap-3">
        <a href={getAsset('/rss.xml')} ...>RSS</a>
        <a href="/blog/" ...>Ver archivo</a>
      </div>
    )}
  ```

- Stated-but-undelivered promises (all live today):
  - `src/pages/newsletter.astro:1-48` — a full "Boletín Semanal de Ciencia
    y Tecnología" page whose only interactive element is the stub above.
  - `src/pages/recursos/detector-de-hype.md:90-94` — "Cada viernes
    enviamos **Noticiencias Semanal**… [Suscribirme al boletín](/newsletter)"
    linking to a page with no working form.
  - `src/components/common/DailyDesk.astro:74-96` — homepage sidebar
    selling "Una vez por semana, solo lo que vale guardar" with Boletín/RSS
    buttons.
- Privacy constraints the decision must honor (quote, don't paraphrase away):
  - `src/pages/privacidad.md:42-46,66,78` — collects "Dirección de correo
    electrónico (para el boletín)", uses it "Para enviarle el boletín",
    unsubscribes via an "Unsubscribe" footer link. So the privacy policy
    ALREADY promises newsletter email handling: the provider must support
    footer-unsubscribe and deletion-on-request.
  - `src/pages/transparencia.md:23` — "Solo usamos métricas agregadas sin
    PII." Open/click tracking policy for the newsletter must be consistent
    with this line (either no tracking pixels, or a documented update to
    this page — flag it, don't silently contradict it).
- Repo conventions that apply:
  - LAW-F3 (server-first, `AGENTS.md`): the capture must stay a plain HTML
    `<form method="post">` plus scoped script — no client-framework island.
    The existing `NewsletterCapture.astro` form shape is the pattern to keep.
  - `form-action 'self'` in the CSP (`src/components/template/common/CommonMeta.astro:11`):
    a third-party form `action=` URL requires a CSP update in that exact file.
  - Doc-drift rule (`AGENTS.md` §8): touching `src/config.yaml` in the later
    build requires updating the corresponding active doc in the same PR and
    keeping `npm run check:doc-drift` green. This spike only WRITES the ADR,
    so no drift risk now — but the ADR must name this obligation for the
    build plan.
- ADR format exemplar: `docs/adr/0000-adr-template.md` (Context / Decision /
  Consequences / Alternatives table). ADR-0008 (`docs/adr/0008-markdown-for-agents.md`)
  is the quality bar for evidence (it verified plan limits and live headers
  before deciding).

## Commands you will need

| Purpose                     | Command                    | Provenance | Expected on success |
| --------------------------- | -------------------------- | ---------- | ------------------- |
| Baseline lint               | `npm run lint`             | declared   | exit 0              |
| Baseline content validation | `npm run validate:content` | declared   | exit 0              |
| Doc-drift gate              | `npm run check:doc-drift`  | declared   | exit 0              |
| Audit suite                 | `npm run test:audit`       | declared   | all pass            |

**Provenance**: `declared` = read from `package.json`/`AGENTS.md`, not run by
the advisor (installs forbidden in the user's tree). A `declared` command
that fails on the unmodified checkout is a broken baseline — see Step 0.

## Scope

**In scope** (the only files you should modify):

- `docs/adr/0009-newsletter-backend.md` (create — the spike deliverable)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `src/config.yaml` — setting the endpoint is the later build plan's job.
- `src/components/common/NewsletterCapture.astro`, `src/pages/newsletter.astro` — no markup changes in a spike.
- `src/pages/privacidad.md`, `src/pages/transparencia.md` — the ADR may
  PROPOSE wording changes, but do not edit policy pages in a spike; list
  them as required follow-ups.
- Any provider SDK install, account creation, or secret handling — no
  credentials, no `.env` changes, no secret values anywhere.

## Git workflow

- Branch: `advisor/001-newsletter-backend-spike`
- Commit style: conventional, matching history (e.g. `docs: spike newsletter backend decision (plan 001)`). Reference examples: `docs: fix Plan 081 documentation drift`, `feat(social): Buffer adapter, publisher orchestration and distribution workflow (pkg 7)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Establish a green baseline

On the unmodified checkout, run `npm run lint`, `npm run validate:content`,
`npm run check:doc-drift`. (Skip `test:audit` here; run it once at the end.)

- If all pass: record that, proceed.
- If a `declared` command does not exist or fails on the unmodified
  checkout: **STOP and report** — include command + exact output. Do not fix
  the build to get moving.

**Verify**: all three commands exit 0 on the unmodified checkout.

### Step 1: Confirm the stub is still live

Re-verify the four evidence sites from "Current state" (config value,
`isEnabled` fallback branch, newsletter page, hype-guide Friday promise).
One command covers the code side:

**Verify**: `grep -n "newsletter_endpoint" src/config.yaml src/components/common/NewsletterCapture.astro` shows `newsletter_endpoint: ''` and the `|| ''` fallback. If the endpoint is now non-empty, **STOP and report** — the premise changed and the spike question may be answered.

### Step 2: Shortlist providers against the repo's hard constraints

Evaluate exactly three options — Buttondown, ConvertKit (Kit), and one
self-hosted/static-compatible option (e.g. Listmonk on existing infra or
Cloudflare-compatible email service) — scoring each on:

1. Plain-HTML form POST support (no JS SDK required — LAW-F3).
2. Double opt-in + footer-unsubscribe + deletion-on-request (privacidad.md promises).
3. No-PII-compatible tracking posture vs `transparencia.md:23` (open/click
   pixels on or off by default?).
4. Cost at 0–10k subscribers + data residency (privacidad.md declares
   Country: Chile).
5. `form-action` CSP implications (which exact URLs must be added to
   `CommonMeta.astro:11`).
6. Spanish-language template/confirmation-email support (audience is
   580M Spanish speakers per `src/config.yaml:19`).

**Verify**: shortlist table exists in your working notes with all six rows
scored for all three options — this becomes the ADR's Alternatives table.
No command; the Step 4 done-criteria check covers it.

### Step 3: Define the wire contract for the later build

Specify, without implementing: the exact `newsletter_endpoint` value shape
(URL), request method/fields (must match the existing form's `email` field
name in `NewsletterCapture.astro:43-49`), success/duplicate/error response
handling within a no-JS form POST (redirect targets), and how bounce/
complaint handling works per provider. Also specify what the build plan must
change file-by-file (`src/config.yaml`, CSP in `CommonMeta.astro`, active
docs per the doc-drift rule).

**Verify**: contract section drafted with field names copied verbatim from
`NewsletterCapture.astro` (`email`, `newsletter-email`). If the form's field
names differ from this plan's excerpt, **STOP and report** (drift).

### Step 4: Write `docs/adr/0009-newsletter-backend.md`

Follow `docs/adr/0000-adr-template.md` exactly (title, Date, Status:
Proposed, Context, Decision with one recommended provider, Consequences,
Alternatives table from Step 2). Must also contain: wire-contract summary
(Step 3), required follow-up edits to `privacidad.md`/`transparencia.md`
listed explicitly (not made), the `form-action` CSP change named, an ops
note (who sends the Friday edition — manual vs automated — and what happens
if nobody sends it: the hype-guide promise needs a fallback), and open
questions for the maintainer (max 3).

**Verify**: `npm run check:doc-drift` exits 0 and `npm run test:audit`
passes with only the new ADR file added (`git status --short` shows
`docs/adr/0009-newsletter-backend.md` and `plans/README.md` only).

## Test plan

No production code changes, so no new unit tests. Regression safety:

- `npm run test:audit` → all pass (pattern for suite shape: `tests/` Vitest
  files, e.g. `tests/site-integrity.test.ts`).
- `npm run check:doc-drift` → exit 0 (new ADR must not break drift gates).
- Manual: read the ADR cold — a reviewer who has not seen this plan must be
  able to approve/reject the provider pick from the Alternatives table alone.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run validate:content` exits 0
- [ ] `npm run check:doc-drift` exits 0
- [ ] `npm run test:audit` exits 0, no new failures
- [ ] `docs/adr/0009-newsletter-backend.md` exists, follows the 0000 template sections, names one recommended provider with six-criterion scoring
- [ ] `git diff --name-only 8af478b...HEAD` (three dots) lists only `docs/adr/0009-newsletter-backend.md` and `plans/README.md`
- [ ] `plans/README.md` status row for 001 updated
- [ ] No secret values, account IDs, or API keys anywhere in the new file

## STOP conditions

Stop and report back (do not improvise) if:

- The code at "Current state" locations doesn't match the excerpts (drift).
- `newsletter_endpoint` is already non-empty (premise answered).
- A step's verification fails twice after a reasonable fix attempt.
- The spike appears to require touching an out-of-scope file.
- A `declared` command does not exist or fails on the unmodified checkout (Step 0).
- Any provider evaluation would require creating an account, installing an
  SDK, or handling a credential — evaluate from public docs only.

## Maintenance notes

- The later build plan (not this one) will set `newsletter_endpoint`,
  update the CSP, and sync active docs; point it at this ADR as its spec.
- Reviewer scrutiny: provider lock-in and the transparencia.md tracking
  tension — the cheapest ADR to get wrong is the one that picks pixels-on
  tracking against a no-PII promise.
- **Deferred:** automated Friday-edition generation from recent posts (needs the backend pipeline; unblocked by nothing here — just not worth speccing before the provider exists).
- **Deferred:** A/B copy for the capture form — needs traffic data from plan 003 first.
