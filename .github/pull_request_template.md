## Article or code change

Describe the change, its source or related issue, and the intended result.
For automated publication, include the article/publication ID when available.

## Verification

List the commands run and their results. Apply `AGENTS.md`'s change matrix.
Content Guard's exact checks are defined in `.github/workflows/content-guard.yml`.

- [ ] Posts satisfy `src/content.config.ts`, including `categories` (plural),
      intentional date, image alt text and required v2 editorial fields.
- [ ] Images and links were verified for the affected content.
- [ ] Relevant tests and content checks passed.
- [ ] Active documentation and the backend mirror were updated if their contracts changed.
- [ ] Visual or interaction changes were checked at 375px and 1280px.
