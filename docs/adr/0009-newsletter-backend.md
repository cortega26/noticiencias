# ADR-0009: Newsletter backend — Buttondown via plain-HTML form POST

- **Date**: 2026-09-15
- **Status**: Proposed

## Context

The site promises a weekly email edition ("Boletín Semanal" / "Noticiencias
Semanal") in at least three reader-facing places — `src/pages/newsletter.astro`
(the Boletín page), `src/pages/recursos/detector-de-hype.md:90-94` ("Cada
viernes enviamos Noticiencias Semanal"), and the homepage sidebar in
`src/components/common/DailyDesk.astro:74-96` — but captures zero emails:
`src/config.yaml:85` sets `newsletter_endpoint: ''`, so
`src/components/common/NewsletterCapture.astro:18-19` computes
`isEnabled = false` and readers get RSS/archive fallback links instead of a
form (`NewsletterCapture.astro:55-70`).

Hard constraints on any backend choice:

- LAW-F3 (server-first): the existing capture form is a plain `<form
method="post">` submitting exactly one field, `name="email"`
  (`NewsletterCapture.astro:42-49`; `newsletter-email` is the input `id` for
  the `<label>`, not a submitted field). No `client:*` island may be added
  for subscribe.
- CSP: `form-action 'self'` in
  `src/components/template/common/CommonMeta.astro:11` — any third-party POST
  target needs an explicit allowlist entry.
- Privacy posture: `src/pages/privacidad.md:42-46,66,78` already promises
  newsletter email handling with footer-unsubscribe and deletion on request;
  `src/pages/transparencia.md:23` states "Solo usamos métricas agregadas sin
  PII." The provider must support double opt-in, footer-unsubscribe, and
  deletion-on-request, and must allow per-recipient open/click tracking to
  stay OFF.
- Data residency declared in `privacidad.md:27` is Chile; any US/EU-hosted
  provider needs its transfer basis named, not hand-waved.
- Spanish-speaking audience: confirmation and welcome emails must be
  authorable in Spanish.

This spike builds nothing: no SDK, no account, no secret. Public docs only.

## Decision

Use **Buttondown** (hosted, `buttondown.com`) as the newsletter backend,
wired as a no-JS plain-HTML form POST from the existing `NewsletterCapture`
markup, with open and click tracking left disabled.

Why it wins, criterion by criterion (all from public docs, verified
2026-09-15):

1. **Plain-HTML form POST**: Buttondown documents an embed-subscribe form
   endpoint, `POST https://buttondown.com/api/emails/embed-subscribe/<username>`,
   whose only required field is `name="email"` (Buttondown blog,
   "UTM via forms", 2025-09-27, shows the exact `<form action=... method="post">`
   snippet). This matches the current markup 1:1 — no field rename, no JS,
   no proxy endpoint, LAW-F3 intact.
2. **Double opt-in + footer-unsubscribe + deletion**: double opt-in is
   mandatory-by-default on Buttondown ("Double opt-in",
   `docs.buttondown.com/double-opt-in`; API-created subscribers default to
   unactivated pending confirmation). Unsubscribe is honored immediately on
   every newsletter, with a self-serve subscriber Portal (`docs.buttondown.com/portal`,
   `buttondown.com/legal/gdpr-eu-compliance`); per-subscriber deletion is a
   documented API operation (`DELETE /subscribers/{id_or_email}`,
   `docs.buttondown.com/api-subscribers-delete`) and GDPR erasure requests
   are honored on request.
3. **No-PII tracking posture**: open tracking and click tracking are both
   **opt-in** on Buttondown — pixels/link-rewriting are only injected after
   the operator turns them on (`docs.buttondown.com/open-tracking`,
   `docs.buttondown.com/click-tracking`), and the vendor's privacy page
   states tracking can be fully opted out
   (`marketing.buttondown.com/features/privacy`). This is the only
   shortlisted option whose default posture already matches
   `transparencia.md:23`.
4. **Cost at 0–10k subscribers + data residency**: free for the first 100
   subscribers; paid tiers scale with active subscribers only (Basic ~$9/mo
   at ~1k, Standard ~$29/mo at ~5k, Professional ~$79/mo at ~10k — confirm
   live figures at build time, `buttondown.com/pricing`). Residency: US
   company (Buttondown LLC), GDPR-compliant via DPA with sub-processor list
   (`buttondown.com/legal/gdpr-eu-compliance`); Chile has no in-country
   hosting requirement, so the follow-up is disclosure wording in
   `privacidad.md`, not a blocker.
5. **CSP**: exactly one new token in `CommonMeta.astro:11` —
   `form-action 'self' https://buttondown.com`. No `script-src`,
   `connect-src`, or image-allowlist change (no JS snippet, no pixel when
   tracking stays off).
6. **Spanish templates**: confirmation email copy and newsletter templates
   are operator-authored text (`docs.buttondown.com/transactional-emails-confirmation`),
   so the double-opt-in and welcome emails are written in Spanish directly.
   No built-in `es` locale toggle was found in public docs; Spanish support
   means "we author the strings", which is sufficient for one weekly
   edition.

## Consequences

What becomes easier:

- The later build is a config-plus-CSP change, not a feature: fill
  `newsletter_endpoint` in `src/config.yaml`, add the one `form-action`
  token, and the existing `NewsletterCapture` form (homepage, `/newsletter/`)
  starts capturing emails with zero markup changes.
- Privacy promises stay truthful by default: double opt-in is mandatory, not
  a setting someone can forget; tracking defaults to off, matching the
  transparencia page without extra work.
- Ops stays proportional to a static site with no backend team: no server,
  database, or SMTP reputation to run (see Alternatives for the self-hosted
  cost).

What becomes harder or constrained:

- Vendor lock-in on subscriber data and sending reputation; mitigated by
  export (subscriber list export is a documented dashboard/API operation)
  and by the fact that the form contract is portable plain HTML.
- US data processing must be disclosed: `privacidad.md` needs a
  sub-processor + international-transfer sentence (listed below, not made
  here).
- Free tier caps at 100 subscribers — the Friday edition needs a paid tier
  almost immediately after launch; budget ~$9/mo from day one and re-check
  pricing at build time.

## Alternatives considered

| Option                                        | Reason rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kit (formerly ConvertKit), hosted             | Plain-HTML subscribe posts to `https://app.convertkit.com/forms/<FORM_ID>/subscriptions` but the email field is `name="email_address"`, not `email` — requires renaming the submitted field and re-verifying the "only submitted field" contract. Open/click tracking is on by default per broadcast (pixel at `open.convertkit-mail.com`, links rewritten via `click.convertkit-mail.com`), which contradicts `transparencia.md:23` unless actively disabled per send. Free Newsletter tier reaches 10k subscribers but carries Kit branding and default Creator Network enrollment; paid Creator starts ~$25–39/mo at 1k (verify live). Heavier creator-marketing platform than a static site needs; Buttondown matches the existing markup exactly, Kit does not. |
| Listmonk (self-hosted, AGPLv3, Go + Postgres) | Strongest on data residency (we host it, so data lives where we put it) and cost (free software; infra + SMTP spend only). Public subscription API `POST /api/public/subscription` accepts form-encoded requests with per-list double opt-in, per-campaign `UnsubscribeURL`, subscriber delete API, and SES/POP3 bounce handling (`listmonk.app/docs`). Rejected on ops: needs a Postgres database, a host, SMTP sending + bounce mailbox, upgrades, and backups — a standing server for a team whose frontend is a static site with no backend rotation. Correct choice only if subscriber volume or data-sovereignty demands later outgrow a hosted provider; revisit then.                                                                                        |

## Wire contract for the later build (specified, not implemented)

- **Endpoint shape**: `POST https://buttondown.com/api/emails/embed-subscribe/<username>`
  where `<username>` is the Buttondown newsletter username. Stored in
  `src/config.yaml` as `form.newsletter_endpoint` (the full URL, same pattern
  as the existing `form.endpoint` for reports).
- **Method/fields**: `method="post"`, single submitted field `name="email"`
  (`type="email"`, `required`). No other field is submitted today; optional
  hidden fields (`tag`, `utm_*`) may be added later without touching the
  component contract. The input `id="newsletter-email"` stays as-is (label
  binding only).
- **No-JS outcomes**: success → Buttondown-hosted confirmation page ("check
  your email to confirm", double opt-in); duplicate (already-subscribed
  address) → provider shows an already-subscribed notice, no duplicate
  record; invalid address → provider-side error page. Confirm the exact
  redirect-target configurability on the current Buttondown plan at build
  time (open question 2).
- **Bounce/complaint handling**: provider-side. Buttondown tracks
  deliverability per subscriber (subscriber dashboard exposes undeliverable
  status columns) and immediately honors unsubscribes; hard bounces and spam
  complaints suppress future sends automatically. No site-side webhook work
  in the initial build.
- **File-by-file change list for the build**: (1) `src/config.yaml` — fill
  `newsletter_endpoint`; (2)
  `src/components/template/common/CommonMeta.astro:11` — append
  `https://buttondown.com` to `form-action`; (3) `src/pages/privacidad.md` —
  sub-processor + US-transfer wording (proposed below); (4)
  `src/pages/transparencia.md` — newsletter-PII carve-out wording (proposed
  below); (5) active-doc check per AGENTS.md §8 (`npm run check:doc-drift`
  must stay green). No change needed in `NewsletterCapture.astro` or
  `newsletter.astro` — the form already matches this contract.
- **Production edge CSP (operator task, Cloudflare dashboard — not the build
  executor)**: the Response Header Transform Rule for `noticiencias.com` +
  `www` must also allow `https://buttondown.com` in `form-action`. Browsers
  enforce the edge response-header CSP in addition to the `<meta http-equiv>`
  tag, so the meta-tag edit alone does not enable the form in production
  (see `docs/DEPLOYMENT_SECURITY_HEADERS.md:26-33`).
- **Live verification (launch blocker)**: `curl -sI https://noticiencias.com/
| grep -i content-security-policy` must show the `form-action` entry, plus
  one real end-to-end test submission with the double-opt-in email arriving,
  before the build is called done. Unapplied edge change blocks launch.

## Required privacidad.md / transparencia.md follow-ups (listed, not made)

1. `privacidad.md` — add one sentence naming Buttondown LLC (US) as the
   newsletter sub-processor, what is stored (email address + send/open
   metadata only when tracking is enabled — currently disabled), and the
   transfer basis (DPA). Must also state the request path for export/deletion
   (footer link + `privacidad@noticiencias.com`).
2. `transparencia.md:23` — carve out the newsletter explicitly, e.g.:
   "El boletín almacena tu correo solo para enviarte la edición semanal;
   no usamos píxeles de apertura ni seguimiento de clics." Keep the
   no-PII-analytics claim for the website itself.
3. Both edits ship in the build PR that fills the endpoint — never enable
   capture before the disclosure is live.

## Ops note

The Friday edition needs a named human sender (editor role, not this ADR to
assign): one person composes/sends "Noticiencias Semanal" each Friday from
the Buttondown dashboard. Fallback if nobody sends it: send nothing — the
site, RSS feed, and archive keep working, the form stays live, and the next
week resumes normally. Never send an empty or filler issue to hit the
schedule.

## Open questions (max 3)

1. Sending domain: Buttondown subdomain vs. custom `noticiencias.com`
   sender — custom improves deliverability/branding but needs DNS (SPF/DKIM)
   the static-site team must coordinate; decide at build time.
2. Confirm on the current Buttondown plan: Spanish confirmation-email text,
   success/duplicate redirect-target configurability, and whether the
   confirmation page can link back to `/newsletter/`.
3. Who owns the account identity, billing (~$9/mo from launch), and the
   Friday send — name the human before the build PR merges.
