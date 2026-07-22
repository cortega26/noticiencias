# Supported dependency matrix

This document records the supported Node, Astro, and Tailwind versions for the
Noticiencias frontend. It is the authoritative reference for CI, deployment
environments, and future framework upgrades.

## Current matrix (plan 032, July 2026)

| Layer      | Supported version | Notes                                                                      |
| ---------- | ----------------- | -------------------------------------------------------------------------- |
| Node.js    | `>=24.0.0 <25`    | Pinned in `package.json#engines`; CI uses `node-version: 24`               |
| Astro      | `^7.1.3`          | Astro 7 (Rust compiler, Sätteri Markdown, `compressHTML: 'jsx'`)           |
| Tailwind   | `^4.3.3`          | Via `@tailwindcss/vite` (not `@astrojs/tailwind`)                          |
| MDX        | `^7.0.3`          | Peers Astro 7                                                              |
| Vite       | `^8` (via Astro)  | No direct vite config beyond the tailwindcss plugin                        |
| Playwright | `^1.61.1`         | Projects: `mobile-375` (Pixel 5), `desktop-1280` (Desktop Chrome)          |
| Vitest     | `4.0.18` (pinned) | Pinned for `@cloudflare/vitest-pool-workers` compatibility (plan 031 STOP) |
| sharp      | `^0.35.3`         | Pulls libvips CVE fixes (GHSA-f88m-g3jw-g9cj)                              |

## Peer validity

`npm ls --omit=dev` must exit 0 in CI. This gate (added in plan 032 step 5 to
`.github/workflows/content-guard.yml`) fails the build if any production
dependency declares an invalid peer range. The Astro 6 graph had three invalid
peers (`@astrojs/tailwind`, `@astrolib/analytics`, `@astrolib/seo`); all three
were removed in plans 032 step 2-3.

## Production audit

`npm audit --omit=dev` must report zero high/critical production advisories.
Remaining dev-only advisories (esbuild Windows dev-server, vitest UI, fast-uri)
are tracked separately and are not production-exposed.

## Upgrade protocol

Future framework majors require:

1. `npm ls` exit 0 (no invalid peers)
2. `npm audit --omit=dev` zero high/critical
3. `npm run build` stable route/post count
4. `npm run test:e2e` green at both 375px and 1280px
5. `npm run test:audit` (vitest) green
6. `npx astro check` 0 errors
7. Metadata DOM snapshots byte-identical (or intentional diffs documented)

Run `bash ../noticiencias_news_collector/plans/032/tests/harness.sh all` to
verify all of the above in one command.
