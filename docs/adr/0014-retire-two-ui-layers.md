# ADR-0014: Retire the two UI layers and the template freeze

- **Date**: 2026-10-20
- **Status**: Accepted (supersedes [ADR-0002](0002-two-ui-layers.md))

## Context

ADR-0002 introduced two UI layers — `src/components/ds/` for Noticiencias
design-system primitives and `src/components/template/` for the AstroWind shell —
with a one-way rule (`template` may compose `ds`, never the reverse) enforced by
the template freeze guard (plan 112) and LAW-F2.

Plans 179–183 removed the dead template components, migrated the leaf surfaces
(`ReportForm`, `SocialShare`) and then the base shell (`Layout`, `MarkdownLayout`,
`Header`, `Logo`, toggles, metadata/analytics, `buildHead`/`seo`, `Image`) into
`src/layouts/` and `src/components/common/`, and deleted the dead
`PageLayout`/`LandingLayout`. No production file imports
`src/components/template/**` or `src/layouts/template/**`; both paths are empty.

The migration was proved behaviour-neutral: 313/313 built HTML SHA-256 identical,
canonical/OpenGraph/JSON-LD identical on five sampled routes, and 17 Playwright
screenshots at 375×812 and 1280×800 with zero differing pixels. The full suite
(987 tests), `test:dist`, `astro check`, the reachability checker and the freeze
guard were green.

## Decision

1. **One supported UI structure.** `src/components/ds/` owns design-system
   atoms/molecules/organisms (route-agnostic, typed); `src/components/common/`
   owns site-specific fragments (shell/header/metadata); `src/layouts/` owns page
   chrome. No third component taxonomy is introduced.
2. **The template layer is retired.** `src/components/template/` and
   `src/layouts/template/` are removed and must not be recreated. New work goes
   to `ds/`, `common/` or `layouts/`.
3. **The freeze guard is removed.** `scripts/freeze-template.js`,
   `npm run check:freeze` and its `validate:content` step are deleted; the
   reachability checker (ADR-0014's migration, plan 181) is the standing guard
   against orphan components.
4. **The old dependency rule becomes a tombstone.** `ds` remains route-agnostic
   and typed; no file may import from the removed template paths. Historical
   references stay in ADR-0002 and archived plans/audits.

## Consequences

- Reviewers maintain one component decision (`ds` vs `common` vs `layouts`)
  instead of two parallel taxonomies.
- Future AstroWind upgrades are applied directly to `ds`/`common`; there is no
  separate shell fork.
- The migration did not change markup, CSS, metadata or runtime behaviour; the
  HTML/screenshot evidence is recorded in plan 183 and the ledger.
- Historical records (ADR-0002, `plans/`, `docs/audits/`, `CHANGELOG.md`) remain
  point-in-time documents and are not rewritten.

## Alternatives considered

| Option                                        | Reason rejected                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Keep the empty template paths as a tombstone  | Dead paths invite accidental reintroduction; the reachability checker and this ADR make the rule explicit without them |
| Keep the freeze guard as a no-op              | Ceremony without files; it would fail on its own missing script                                                        |
| Keep two layers for future AstroWind upgrades | The shell already lives in `common`/`layouts`; a second layer has no consumers                                         |
