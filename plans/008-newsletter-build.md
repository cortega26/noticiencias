# Plan 008: Wire the Buttondown newsletter backend (endpoint + CSP + disclosures)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 907bf50..HEAD -- src/config.yaml src/components/template/common/CommonMeta.astro src/pages/privacidad.md src/pages/transparencia.md src/components/common/NewsletterCapture.astro docs/adr/0009-newsletter-backend.md tests/config-builder.test.ts README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (fulfils the Friday-edition promise once merged)
- **Effort**: S (config + CSP + policy wording + tests; zero markup changes expected)
- **Risk**: MED (first change that collects reader PII — the disclosures must be live in the SAME change, and the sender identity must be real)
- **Depends on**: ADR-0009 `Accepted` (verify in Step 0 — STOP otherwise); operator-supplied endpoint URL + named Friday owner + billing owner (Step 0 gate — STOP if missing). Soft: plan 001 DONE (it is; full spec inlined below). Order: runs AFTER plan 007 (both touch `src/config.yaml` + `CommonMeta.astro:11` — never parallelize).
- **Category**: direction-build
- **Planned at**: commit `907bf50`, 2026-09-15

## Why this matters

This is the change that makes the promised Boletín real: fill the endpoint
the stub is waiting for, allowlist the POST target, and publish the
disclosures the privacy policy already anticipates. It is deliberately
small — the form markup already matches the provider contract 1:1, so any
diff beyond config + CSP + wording + tests is a smell. Capture must never
go live before the disclosure text does; this plan ships them atomically.

## Current state

The facts the executor needs, inlined (re-verify each in Step 1):

- `src/config.yaml:76-85`:

  ```yaml
  form:
    # Report-a-problem endpoint. Enabled after the Worker's durable sink
    # (R2 bucket noticiencias-reports) was provisioned and verified live
    # (plan 023, 2026-08-11): POST -> 201 with report id, idempotent retries.
    endpoint: 'https://noticiencias.com/api/report'
    # Newsletter capture endpoint — deliberately separate from the report
    # endpoint (the two forms have different wire contracts). Stays empty
    # until a newsletter backend exists; the page then shows RSS/blog
    # alternatives instead of a form that would POST to /api/report.
    newsletter_endpoint: ''
  ```

- Form contract (`src/components/common/NewsletterCapture.astro:39-49`):
  single submitted field `name="email"` (`type="email"`, `required`);
  `id="newsletter-email"` is label binding only. When the endpoint is
  non-empty the `<form action={endpoint} method="post">` renders on
  `/newsletter/`, the homepage `DailyDesk`, and `Newsletter.astro` with
  ZERO markup changes.

- CSP: `src/components/template/common/CommonMeta.astro:11` —
  `form-action 'self'` today; the build appends `https://buttondown.com`.

- Spec (inlined from ADR-0009; authoritative if the ADR file is absent):
  `POST https://buttondown.com/api/emails/embed-subscribe/<username>`,
  single `email` field; success → provider-hosted double-opt-in
  confirmation page; duplicates → already-subscribed notice, no duplicate;
  bounces/complaints provider-side, no site webhook. No `NewsletterCapture`
  or `newsletter.astro` change needed.

- Policy anchors: `src/pages/privacidad.md:42-46,66,78` (boletín email
  handling, footer unsubscribe); `src/pages/transparencia.md:23` (aggregate
  metrics, no PII); `README.md:55-60` describes the empty-endpoint fallback
  behavior — it goes stale the moment the endpoint fills, so it is in scope
  for the same-PR update (doc-drift rule, AGENTS.md §8).

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

- `src/config.yaml` (fill `newsletter_endpoint` with the operator-supplied URL)
- `src/components/template/common/CommonMeta.astro` (append `https://buttondown.com` to `form-action`)
- `src/pages/privacidad.md` (sub-processor + US-transfer sentence, Spanish, per ADR proposal)
- `src/pages/transparencia.md` (newsletter carve-out sentence, Spanish, per ADR proposal)
- `README.md` (update the stale empty-endpoint paragraph only)
- `tests/config-builder.test.ts` (extend: newsletter endpoint override merges; mirror the existing form-endpoint case)
- Whatever `npm run check:doc-drift` additionally demands because of the above
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):

- `NewsletterCapture.astro`, `newsletter.astro`, `DailyDesk.astro` — no markup changes; if the form does not render with the endpoint filled, STOP (contract drift), do not "fix" the component.
- Sending-domain DNS (SPF/DKIM), Buttondown account settings, billing — operator tasks, recorded not performed.
- Any other provider, SDK, or server-side code. No secrets in the repo (the endpoint URL carries the public newsletter username — that is public, not a secret — but no API keys, ever).

## Git workflow

- Branch: `advisor/008-newsletter-build`
- Commit style: conventional (e.g. `feat(newsletter): wire Buttondown endpoint, CSP and disclosures (plan 008)`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline + hard gates

1. Run the plan's drift check. On mismatch vs "Current state": STOP.
2. Confirm `docs/adr/0009-newsletter-backend.md` reads `Status: Accepted`. If
   `Proposed` or absent: STOP.
3. Obtain from the operator (it must be given to you with this plan; never
   invent it): (a) the exact `newsletter_endpoint` URL
   (`https://buttondown.com/api/emails/embed-subscribe/<username>`);
   (b) the named Friday-sender human; (c) the billing owner;
   (d) the sending-domain decision — Buttondown subdomain (default, no DNS
   work) vs custom domain (only if the operator confirms SPF/DKIM DNS is
   DONE; otherwise ship subdomain and record custom as follow-up).
   If (a) is missing: STOP — there is nothing to wire.
4. Run `npm run lint`, `npm run validate:content` unmodified; record
   `git rev-parse --short HEAD` as `<start-SHA>`.

**Verify**: drift empty-or-reported; ADR Accepted; all four operator answers
recorded verbatim in your notes; baseline green; `<start-SHA>` recorded.

### Step 1: Wire endpoint + CSP + disclosures

1. Fill `newsletter_endpoint` in `src/config.yaml` (keep the explanatory
   comment, updated to past tense + ADR reference).
2. Append `https://buttondown.com` to `form-action` in `CommonMeta.astro:11`
   (nothing else in the header changes).
3. Apply the ADR's proposed `privacidad.md` (Buttondown LLC sub-processor +
   US transfer + export/deletion path via footer link and
   `privacidad@noticiencias.com`) and `transparencia.md` (newsletter
   carve-out: email stored only for the weekly edition, no open/click
   pixels) wording, in Spanish, matching surrounding voice.
4. Update the stale `README.md:55-60` fallback paragraph to describe the
   live behavior.

**Verify**: `npm run check:doc-drift` exits 0; `git diff --stat` shows only
in-scope files.

### Step 2: Tests + full gates

1. Extend `tests/config-builder.test.ts`: newsletter endpoint override
   merges over the empty default without dropping sibling defaults (mirror
   the existing form-endpoint case at line ~46).
2. Run: `npm run lint`, `npm run validate:content`, `npm run build`,
   `npm run test:dist`, `npm run test:audit`.
3. Dist assertions on the built site (no-JS contract proof):
   `grep -o 'action="https://buttondown.com[^"]*"' dist/newsletter/index.html`
   returns the exact endpoint URL; same grep on `dist/index.html` (homepage
   capture); `grep -c 'name="email"'` ≥ 1 on both pages.

**Verify**: all gates green; dist greps match; new tests pass
(`npx vitest run tests/config-builder.test.ts`).

## Test plan

- Extended `tests/config-builder.test.ts` (pattern: existing override case):
  newsletter endpoint override merges; empty default otherwise.
- Dist assertions (Step 2.3): form action URL + `name="email"` on
  `/newsletter/` and homepage — this is the no-JS wire-contract proof.
- Manual (reviewer): submit a real address in preview, confirm the
  Spanish double-opt-in email arrives; confirm unsubscribe footer link works.
  Record results in the PR description (build does not automate this).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint`, `npm run validate:content`, `npm run build`, `npm run test:dist`, `npm run test:audit` all exit 0 / pass
- [ ] Dist greps: exact endpoint action on `dist/newsletter/index.html` and `dist/index.html`; `name="email"` present
- [ ] New config-builder tests exist and pass
- [ ] No API keys or secrets anywhere (`grep -rniE "api[_-]?key|sk-live|Bearer [A-Za-z0-9]" src/ tests/ docs/` clean apart from benign prose)
- [ ] `git diff --name-only <start-SHA>...HEAD` lists only in-scope files; zero component/markup diffs
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report (do not improvise) if:

- Drift vs "Current state" excerpts.
- ADR-0009 is not `Accepted`.
- The endpoint URL / owner answers from Step 0 are missing.
- The form does not render with the endpoint filled (contract drift — do not edit components to compensate).
- Custom sending domain chosen without confirmed DNS (ship subdomain default instead ONLY with explicit operator override; otherwise STOP).
- A step's verification fails twice after reasonable fix attempts.
- Out-of-scope file needed, or a `declared` command broken on clean checkout.

## Maintenance notes

- Friday ops begin at merge: named sender owns the first edition within 7
  days or the promise restarts decaying — track outside this plan.
- Re-check Buttondown pricing at billing-owner handoff (free 100 subs cap).
- Reviewer scrutiny: the Spanish disclosure wording (legal tone, not
  marketing) and the exact CSP token (no broader hosts).
- **Deferred (from plan 001):** automated Friday-edition generation; A/B
  form copy (needs plan 003 data — now unblocked once 007 + enablement land).
- **Deferred:** custom sending domain (if subdomain shipped) — needs DNS + deliverability check, separate change.
