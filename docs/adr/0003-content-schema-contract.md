# ADR-0003: Content Schema is a Cross-Repo Contract

- **Date**: 2026-04-15
- **Status**: Accepted

## Context

`src/content/config.ts` defines the Zod schema for the `posts` collection.
The backend (`noticiencias_news_collector`) publishes MDX files into
`src/content/posts/` using this exact field contract. Neither side can change
the schema unilaterally without breaking the other.

The schema currently includes: `title`, `schema_version`, `excerpt`, `author`,
`date`, `categories`, `tags`, `image`, `image_alt`, `permalink`, and additional
Noticiencias editorial metadata fields. This set is the product of coordinated
decisions between the collector pipeline and the front-end rendering layer.

## Decision

The `posts` schema in `src/content/config.ts` is the authoritative cross-repo
contract. It is sealed for autonomous changes.

**Backend-owned fields** (written by `noticiencias_news_collector`; must not be
narrowed, renamed, or removed without a coordinated release):

- `title`, `date`, `author`, `excerpt`
- `categories`, `tags`, `permalink`
- `image`, `image_alt`
- `schema_version`
- All Noticiencias editorial metadata fields (`published`, `featured`, etc.)

**Front-end-owned fields** (display/computed additions never written by the
backend; may be added with `optional()` without backend coordination):

- Virtual or derived fields (e.g., `readingTime`) if added in the future.

**Migration policy for breaking changes**:

1. Bump `schema_version` in the new schema.
2. Write a migration script to backfill existing content files.
3. Coordinate a simultaneous deploy of both repos.
4. Run `npm run validate:content` end-to-end before merge.

## Consequences

- Any PR touching `src/content/config.ts` is automatically high-risk and triggers
  the Critical row in the AGENTS.md change matrix.
- `npm run validate:content` is the mechanical gate; it must pass before merge.
- Agents must not alter this file without confirming the backend contract is still
  satisfied across all published articles.
- Schema defaults introduced for legacy compatibility do not imply new content
  may omit those fields.

## Alternatives Rejected

| Option                               | Reason rejected                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Separate front-end schema layer      | Requires dual-parsing every article at build time; adds complexity for no build-time benefit |
| Loose schema with runtime validation | Static builds cannot surface missing-field errors at the point of rendering failure          |
| Per-field versioning                 | Overly granular; `schema_version` on the document is sufficient for coordinated migration    |
