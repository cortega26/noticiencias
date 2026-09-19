# Deployment Security Headers

`noticiencias.com` is currently deployed with GitHub Pages behind Cloudflare. That hosting shape matters:

- `public/_headers` is documentation only. GitHub Pages does not emit those headers.
- `<meta http-equiv="Content-Security-Policy">` helps browsers, but scanners like SecurityHeaders only score an actual `Content-Security-Policy` response header.
- The production-grade fix belongs at the edge layer that serves `https://noticiencias.com/`.

## Required production headers

The example below is an edge-policy starting point, not the exact assertion
set or evidence of live configuration. `scripts/post-deploy-check-lib.js`
owns enforced header checks; its custom-domain CSP check requires a response
header but does not validate every directive. Reconcile any deployed CSP
with current image, analytics and API origins before applying it.

The `Content-Security-Policy` line below is kept byte-identical to the
`<meta http-equiv="Content-Security-Policy">` tag in
`src/components/template/common/CommonMeta.astro`, which is the enforcing copy
on GitHub Pages. `tests/compliance.test.ts` treats that meta tag as the single
source of truth and fails if this document or `public/_headers` drifts from it,
so edit the component first and mirror the change here.

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.cdn.noticiencias.com; font-src 'self'; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self' https://buttondown.com;
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=()
```

## Cloudflare implementation

If Cloudflare is the active edge for `noticiencias.com`, add a Response Header Transform Rule or equivalent managed header policy:

1. Match host `noticiencias.com` and `www.noticiencias.com`.
2. Set each header above as a response header override.
3. Remove the legacy `interest-cohort=()` directive if Cloudflare rejects it.
4. Keep the Astro `<meta http-equiv="Content-Security-Policy">` temporarily until the response header is confirmed live, then decide whether to retain it as defense in depth.

## Verification

After the edge rule is live, both of these should pass:

```bash
npm run test:deploy -- https://noticiencias.com/
curl -I https://noticiencias.com/
```

Historical observation only (not rechecked in this audit): on `2026-05-25`, the site returned `Strict-Transport-Security: max-age=0; includeSubDomains; preload` and did not return the other required security headers, which is why `https://securityheaders.com/?q=noticiencias.com&followRedirects=on` graded the site `F`.
