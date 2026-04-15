# ADR-0004: npm ci over pnpm

- **Date**: 2026-04-15
- **Status**: Accepted

## Context

The repo shipped both `package-lock.json` and `pnpm-lock.yaml`. CI has always used
`npm ci` against `package-lock.json`. `CONTRIBUTING.md` instructed `pnpm install`,
causing lockfile divergence for any contributor or agent following that document.
Both lockfiles existed because the project was started from an Astrowind template
that used pnpm, but the active CI path was migrated to npm without removing the
pnpm lockfile or updating the contributing guide.

## Decision

Use `npm ci` as the canonical install command. `package-lock.json` is the single
lockfile. `pnpm-lock.yaml` has been deleted. CI already enforces this via the
`cache: npm` step in every workflow that installs dependencies.

## Consequences

- Contributors following `CONTRIBUTING.md` get the exact same environment as CI.
- `pnpm-lock.yaml` is permanently removed; it will not be regenerated.
- Any future package manager switch requires an explicit ADR and CI update.
- Node version constraint is `>=22.20.0 <23` (see `package.json` `engines`);
  `.nvmrc` pins `22.20.0` for local use; CI runs Node 24 for deploy parity.

## Alternatives considered

| Option | Reason rejected |
|--------|-----------------|
| Switch fully to pnpm | Would require updating CI cache keys, Node setup, and all workflow install steps without a material benefit |
| Keep both lockfiles and pick by convention | Ongoing divergence risk; violates the principle that one canonical tool owns the lockfile |
