# Report pipeline operations

Status: Active. Checked against repository configuration on 2026-09-04.

The reader report form is enabled in `src/config.yaml` at
`https://noticiencias.com/api/report`. The production environment in
`workers/wrangler.toml` declares `REPORT_BUCKET` and `RATE_LIMIT_KV`.
These are committed configuration facts; they do not prove current remote
resource availability. Verify existing resources before creating replacements.

## Contract and storage

- `workers/src/utils/validate.ts` owns accepted fields and validation.
  `src/utils/reportPayload.ts` maps the form into that payload.
- `workers/src/handlers/report.ts` owns storage and responses. A fresh
  submission returns `201` only after R2 storage or email delivery succeeds;
  it returns `503` if neither sink succeeds. Receipt is not editorial resolution.
- The body limit is 20,000 bytes. Invalid JSON returns `400`, invalid fields
  `422`, an oversized body `413`, and a rate-limit rejection `429`.
- With `RATE_LIMIT_KV`, the handler applies rate limiting and a 600-second
  retry window keyed by the exact request body. These KV checks do not
  guarantee exactly-once submission under concurrent requests; see
  [Cloudflare KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).
- Without KV, those checks are skipped. Without an available R2 or email
  sink, successful report submission is unavailable.

## Deployment configuration

`.github/workflows/deploy-worker.yml` deploys the production Wrangler
environment after Worker type checks and coverage tests. It uses GitHub
Actions environment `cloudflare-workers` with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Actual secret values belong in the provider's secret
store, never in this document or committed config.

R2 and KV bindings are already present in the production config. For a new
environment, provision its resources and bind their names/IDs in that
Wrangler environment before enabling the form there. Production bindings
are not declared in the preview environment.

Email is an optional additional sink. The existing implementation calls
SendGrid; it requires `EMAIL_API_KEY`, `EMAIL_FROM` and `EMAIL_TO`. Set the
key as a Worker secret in the intended environment.

## Verification

From `workers/`, run `npm ci`, `npm run typecheck` and
`npm run test:coverage` for Worker changes. Frontend form changes also follow
`AGENTS.md` validation requirements.

After an authorized deployment, submit a clearly identified test report
through the form and verify the returned ID in the configured durable sink.
A live submission writes a real report and may send email. A `201` response
alone does not establish that both sinks worked; inspect the intended sink.
The reader report pipeline is separate from the backend publication webhook
in [webhook-integration.md](webhook-integration.md).
