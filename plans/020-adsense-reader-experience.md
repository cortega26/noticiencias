# AdSense-first reader experience

Status: implementation, independent verification pending. Base: `5ab658a9`.
Risk: Critical configuration change plus High shared presentation changes.

## Contract and decisions

- Preserve the current brand, serif headings, static Astro rendering, consent and article URLs. No post schema or dependency changes.
- Promote the existing featured selection and two source-backed guides: `/recursos/carbono-bosques-suelos/` and `/recursos/exoplanetas-atmosferas-biosignaturas/`. These pages are a dependency supplied by the companion editorial branch; integrate that branch first.
- Internal `confirmed`/`verified` statuses mean source support, never independent scientific confirmation. Unknown statuses remain unverified. Human reviewer identity requires a recorded review.
- Newsletter public page returned HTTP 404 on read-only GET 2026-10-22. Remove forms and subscription promises, park the endpoint empty, retain RSS/archive. Reactivation requires a recorded successful destination and double-opt-in check before restoring code and promises. Do not send a test signup without operator authorization.
- All configured category sections currently have posts; retain established navigation and add the two guide destinations.

## Acceptance and verification

- Clear evidence-first homepage, visible guides, controlled long headings and readable article measure at 375/1280, light/dark.
- Source support labels and limitations remain visible, one source panel per article, no fabricated reviews or changed status enums.
- No rendered newsletter form or active signup promise in home, legacy landing page, footer, taxonomy or institutional copy; no conversion event on fallback visits.
- Required checks: lint, typecheck, content validation, build, dist sanity and audit tests. Browser checks cover keyboard, images, console, canonical metadata and layout.
- Baseline before edits: lint and typecheck passed (0 errors, 7 existing hints); content validation/build/dist passed; audit passed (93 files / 1007 tests). Work is tracked in claude-mem `growth-experience-20261022`.
- No commit, push, merge or production deployment by this implementation role. Final verification is local until separately deployed and observed.
