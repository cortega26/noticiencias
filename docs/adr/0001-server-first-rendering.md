# ADR-0001: Server-first rendering as the default

- **Date**: 2024-01-01
- **Status**: Accepted

## Context

Noticiencias is a content-heavy editorial site. Most content is static and authored
in MDX. Adding client-side hydration increases bundle weight, complicates Cloudflare
Pages caching, and creates edge cases around Astro's view-transition lifecycle.
The audience is Spanish-language general news readers, many on mobile and lower-end
connections.

## Decision

Default to plain Astro rendering — no `client:*` directive. Interactive islands are
allowed only when the interaction cannot be delivered with static HTML plus a
tightly-scoped `<script>` tag attached to the owning component.

## Consequences

- Build output is mostly zero-JS HTML — fast on slow connections.
- `window`, `document`, and `localStorage` must never be referenced in Astro
  frontmatter or shared server code (enforced by LAW-F3 in `AGENTS.md`).
- Scripts used across page transitions must be idempotent.
- Any new `client:*` directive is a high-risk change requiring full validation.

## Alternatives considered

| Option | Reason rejected |
|--------|-----------------|
| React-first SPA | SEO and Core Web Vitals penalty; no benefit for editorial content |
| Vue islands by default | Adds a framework dependency without a current use case |
| Astro hybrid (SSR + SSG) | Cloudflare Pages deployment cost; all content is fully static at publish time |
