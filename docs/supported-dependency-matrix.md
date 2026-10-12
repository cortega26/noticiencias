# Supported dependency matrix

This document records the supported Node, Astro, and Tailwind versions for the
Noticiencias frontend. It is derived from `package.json`, `package-lock.json`,
`workers/package.json`, `workers/package-lock.json` and workflow YAML. Those
files own exact versions and CI behavior.

## Current matrix (checked 2026-10-09)

| Layer      | Supported version | Notes                                                                |
| ---------- | ----------------- | -------------------------------------------------------------------- |
| Node.js    | `>=24.0.0 <25`    | Pinned in `package.json#engines`; CI uses `node-version: 24`         |
| Astro      | `~7.2.8`          | Astro 7 (Rust compiler, Sätteri Markdown, `compressHTML: 'jsx'`)     |
| Tailwind   | `^4.3.3`          | Via `@tailwindcss/vite` (not `@astrojs/tailwind`)                    |
| MDX        | `^7.0.3`          | Peers Astro 7                                                        |
| Vite       | Transitive        | Resolved by Astro and the lockfile; not a direct dependency          |
| Playwright | `^1.61.1`         | Projects: `mobile-375` (Pixel 5), `desktop-1280` (Desktop Chrome)    |
| Vitest     | `4.1.11` (pinned) | Main app and Worker use separate lockfiles; Worker pool is `^0.21.1` |
| sharp      | `^0.35.4`         | Image processing; validate the resolved dependency graph on upgrades |

## Peer validity

`npm ls --omit=dev` must exit 0 in CI. By default, `npm ls` displays the
immediate dependency level (depth 0); it does **not** prove that every transitive
package has a valid peer relationship. For deeper diagnostics run
`npm ls --omit=dev --all` and inspect the exact affected paths, separating
production exposure from tooling and build-time exposure. The recursive check
is **not** currently a CI gate; a non-zero result must be investigated, not
silently treated as a passed validation.

## Production audit

When connectivity permits, run `npm audit --omit=dev` and triage any
high/critical advisories affecting production packages; separately examine
build and development tooling where relevant. `npm audit` is **not** part of
the `content-guard.yml` gate. Record the date, lockfile revision, advisory,
affected path and actual runtime exposure. A DNS/registry failure means
**UNVERIFIED**, not a clean audit; this document does not certify that the
current dependency graph has no vulnerabilities.

## Upgrade protocol

Future framework majors require:

1. `npm ls --omit=dev` exit 0 and recursive `npm ls --omit=dev --all` issues triaged
2. `npm audit --omit=dev` high/critical findings resolved or risk-assessed
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
