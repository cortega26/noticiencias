# CLAUDE.md

> **Pointer.** The authoritative AI agent governance document is [`AGENTS.md`](./AGENTS.md).
> Read it before making changes. It contains the binding architectural laws, contracts,
> anti-patterns, validation rules, change matrix, and review checklist.

## Quick commands

```bash
npm run dev          # Start dev server
npm run build        # Full build
npm run lint         # All checks
npm run test:audit   # Run tests
```

## Key facts

- Static Astro 6 site, server-first rendering, no React islands
- Content schema is sealed: `src/content.config.ts` is a cross-repo contract
- Layers: `ds` → `template` → `pages` (not interchangeable)
- Utilities must stay pure; no DOM in `src/utils/`
- Content normalization belongs before rendering; components don't fix broken data

For architecture, data flow, URL structure, image pipeline, and the complete set of
laws and contracts, see [`AGENTS.md`](./AGENTS.md).
