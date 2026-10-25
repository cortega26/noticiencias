# Security and Quality remediation — 2026-10-25

Status: locally verified; deployment and live alert receipts are recorded in the associated pull request. Dependency changes are critical risk under AGENTS.md.

GitHub initially reports16open Dependabot alerts across the root and workers lockfiles, and zero open code-scanning/secret-scanning alerts. Green CI alone does not clear dependency alerts.

Use patched Vitest 4.1.12 with aligned coverage packages, sharp 0.35.5, Undici 7.30.1, AJV-compatible fast-uri 3.1.9, brace-expansion 5.0.12 and postcss-selector-parser 7.1.6. The worker pool pins Zod 4.4.3 exactly; override to patched4.6.6 and validate the real worker runtime. Existing overrides pin vulnerable versions; remove the unnecessary forced fast-uri major and let AJV resolve its supported3.x version. Full npm audit also identified newer Undici advisories than the initial GitHub inventory. Typography pins parser 6.0.10; the parser override therefore requires a real build and full regression checks. No application markup, content, CSP or consent change is intended.

Verification: clean installs; full npm audits including development dependencies in both packages; valid dependency graphs; frontend lint/typecheck/content/build/dist/audit tests; workers typecheck/coverage. Record fresh outcomes before marking complete. Backend findings are tracked in its plan195.

## Dependency-tree triage

The worker recursive graph passes. Frontend `npm ls --all` reports two unchanged
optional-peer mismatches: Astro 7.4.0 expects markdown-remark^7.3.0 while
MDX 7.0.3 pins 7.2.1; MDX expects markdown-satteri^0.3.1 while Astro pins 0.4.4.
Independent comparison confirms the same versions/ranges at the base commit.
Per CONTRIBUTING.md, these are triaged separately; no passing recursive graph
is claimed. Build and tests must establish the supported site's behavior.

## Findings and remediation

1. **High/moderate dependency findings:**16 initial GitHub alerts across the
   site and workers. Remove the stale fast-uri major override; align Vitest and
   coverage at 4.1.12; patch brace-expansion, selector parsing, sharp and Undici.
   The full npm audit additionally identified the worker pool's exact Zod pin;
   it now uses4.6.6. No alerts were dismissed or severity thresholds suppressed.
2. **Audit coverage gap:** green CI previously did not audit all npm trees.
   Content Guard now audits both packages with `--include=dev --audit-level=low`.
   A real negative control rejected the original root lock with 10 vulnerable
   dependency entries even under `NODE_ENV=production`.

## Fresh verification

- Clean root and worker installs passed; full npm audits report 0 vulnerabilities.
- The exact audit commands also pass using only package/lock files in empty
  directories, without installed packages or lifecycle execution.
- Lint, typecheck and content validation passed (0 errors/warnings;7 hints).
- Build: 307 pages; dist checks: 321 verified files and 52 article routes.
- Unit and coverage suite: 1,019 passed. Existing browser suite: 91 passed, 1 skipped.
- Workers: typecheck and 75 tests passed in the real workerd runtime;
  coverage lines 94.27%, branches 92.03%.
- Independent dependency/workflow review found no new P1/P2 issues.

This record covers repository findings and checks; prior local credential
rotation is still an operator action. Zero open GitHub secret alerts does not
establish that previously exposed credentials have been revoked.
