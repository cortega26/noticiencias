# ADR-0002: Two UI layers (ds and template) with a one-way dependency rule

- **Date**: 2024-01-01
- **Status**: Accepted

## Context

The repo inherited the Astrowind template, which ships its own widget and layout
system under `src/components/template/`. Noticiencias needs its own editorial
design-system primitives (article cards, category pills, hero image variants) that
must not be entangled with Astrowind internals.

## Decision

Maintain two explicit UI layers:

- `src/components/ds/` — Noticiencias design-system atoms, molecules, and organisms.
  Route-agnostic, typed props, no collection queries.
- `src/components/template/` — Astrowind shell, legacy widgets, and site structure.

Dependency rule: `template` components may compose `ds` pieces. `ds` components
must never import from `template/`. This keeps the design system portable and
prevents circular coupling.

## Consequences

- New presentational work goes into `ds/`; site-shell work goes into `template/`.
- A third layer must not be created — use `src/components/common/` for fragments
  that fit neither taxonomy.
- Reviewers reject `ds` imports of `template` modules (enforced by LAW-F2 in
  `AGENTS.md`).

## Alternatives considered

| Option                              | Reason rejected                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Single flat `components/` directory | Loses the boundary; template and editorial styles bleed into each other            |
| Replace Astrowind entirely          | Too large a scope; Astrowind provides the site shell with minimal maintenance cost |
| Monorepo package per layer          | Overhead not justified by current team size                                        |
