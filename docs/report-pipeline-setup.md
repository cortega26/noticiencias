# Report pipeline: operator setup (plan 023)

The reader "report a problem" form and its Worker (`workers/`) are code-complete
and tested, but the production endpoint stays **disabled** (`src/config.yaml`'s
`form.endpoint` is empty) until the durable-storage prerequisites below are
provisioned. This is a deliberate STOP per plan 023: never enable the frontend
endpoint before at least one durable sink actually exists.

None of the steps below can be done from a code change — they require actions
in the Cloudflare dashboard/CLI with account credentials.

## 1. Create the R2 bucket (durable storage — required)

```bash
cd workers
npx wrangler r2 bucket create noticiencias-reports
```

Then uncomment the R2 binding in `workers/wrangler.toml`:

```toml
[[env.production.r2_buckets]]
binding = "REPORT_BUCKET"
bucket_name = "noticiencias-reports"
```

## 2. Create the rate-limit/idempotency KV namespace (recommended)

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

Copy the returned `id` into the commented block in `workers/wrangler.toml`:

```toml
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<the id wrangler printed>"
```

Without this binding the endpoint still works, but with no rate limiting or
submission idempotency (a client retry could create a duplicate report).

## 3. Email notifications (optional second sink)

`workers/src/handlers/report.ts`'s `sendEmail()` calls SendGrid's REST API.
Set these as Wrangler secrets (never in `wrangler.toml` or `.env`):

```bash
npx wrangler secret put EMAIL_API_KEY --env production
```

...and set `EMAIL_FROM`/`EMAIL_TO` as plain vars in `wrangler.toml`'s
`[env.production.vars]` (they're addresses, not secrets) or as secrets too if
you'd rather not have them in version control. To use a different provider
(Mailgun, Resend, etc.), edit `sendEmail()` directly — it's a single function.

## 4. Deploy secrets (already required for any Worker deploy)

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets
in the `cloudflare-workers` environment — used by
`.github/workflows/deploy-worker.yml`. If not already set, create an API
token with Workers + R2 + KV edit permissions.

## 5. Enable the endpoint

Only after step 1 (and ideally step 2) is live:

```yaml
# src/config.yaml
form:
  endpoint: 'https://noticiencias.com/api/report'
```

Deploy the Worker (`git push` on `workers/**`, or `workflow_dispatch`), then
the frontend (normal deploy). Verify with:

```bash
curl -i -X POST https://noticiencias.com/api/report \
  -H 'Content-Type: application/json' \
  -d '{"problem_type": "content_factual", "description": "smoke test"}'
```

Expect `201` with a `{"id": "..."}` body once R2 (or email) is bound; `503`
if neither sink is configured yet — that 503 is correct behavior, not a bug
(see `workers/src/handlers/report.ts`'s "at least one durable sink" rule).

## What's already handled without operator action

- Body-size limit (20KB), strict field validation, and hostname dot-boundary
  checks — no setup needed, always active.
- Rate limiting (5 req/min/IP) and idempotency (10-minute window) — active
  automatically once `RATE_LIMIT_KV` is bound (step 2); silently skipped
  (not failed) if it isn't.
- CI gates: `workers/tests/*.test.ts` (validation + handler-level runtime
  tests with mocked bindings), `tsc --noEmit`, and an 80% coverage threshold
  all run in `.github/workflows/deploy-worker.yml` before every deploy.
