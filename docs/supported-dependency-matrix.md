# Supported dependency matrix

This document records the supported Node, Astro, and Tailwind versions for the
Noticiencias frontend. It is derived from `package.json`, `package-lock.json`,
`workers/package.json`, `workers/package-lock.json` and workflow YAML. Those
files own exact versions and CI behavior.

## Current matrix (checked 2026-09-04)

| Layer      | Supported version | Notes                                                                |
| ---------- | ----------------- | -------------------------------------------------------------------- |
| Node.js    | `>=24.0.0 <25`    | Pinned in `package.json#engines`; CI uses `node-version: 24`         |
| Astro      | `^7.1.3`          | Astro 7 (Rust compiler, Sätteri Markdown, `compressHTML: 'jsx'`)     |
| Tailwind   | `^4.3.3`          | Via `@tailwindcss/vite` (not `@astrojs/tailwind`)                    |
| MDX        | `^7.0.3`          | Peers Astro 7                                                        |
| Vite       | `^8` (via Astro)  | No direct vite config beyond the tailwindcss plugin                  |
| Playwright | `^1.61.1`         | Projects: `mobile-375` (Pixel 5), `desktop-1280` (Desktop Chrome)    |
| Vitest     | `4.1.10` (pinned) | Main app and Worker use separate lockfiles; Worker pool is `^0.21.1` |
| sharp      | `^0.35.3`         | Image processing; validate the resolved dependency graph on upgrades |

## Peer validity

`npm ls --omit=dev` must exit 0 in CI. This gate (added in plan 032 step 5 to
`.github/workflows/content-guard.yml`) fails the build if any production
dependency declares an invalid peer range. The Astro 6 graph had three invalid
peers (`@astrojs/tailwind`, `@astrolib/analytics`, `@astrolib/seo`); all three
were removed in plans 032 step 2-3.

## Production audit

`npm audit --omit=dev` must report zero high/critical production advisories.
Record the audit date, lockfile revision and affected dependency path when
triaging findings. Development dependencies need their own exposure review;
this document does not certify the absence of current vulnerabilities.

## Upgrade protocol

Future framework majors require:

1. `npm ls` exit 0 (no invalid peers)
2. `npm audit --omit=dev` zero high/critical
3. `npm run build` stable route/post count
4. `npm run test:e2e` green at both 375px and 1280px
5. `npm run test:audit` (vitest) green
6. `npx astro check` 0 errors
7. Metadata DOM snapshots byte-identical (or intentional diffs documented)

Use `npm run verify:ci` for the aggregate local gate. It does not replace
the dependency audit or intentional snapshot review above. Run Worker
checks from `workers/` separately (`npm run typecheck` and
`npm run test:coverage`); `.github/workflows/content-guard.yml` and
`.github/workflows/deploy-worker.yml` own the full CI step lists.
