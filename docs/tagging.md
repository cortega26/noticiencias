# Tagging Contract

Status: Active  
Scope: Noticiencias backend taxonomy pipeline and frontend published content

## Purpose

This document defines the current cross-repo tag contract.

It exists so frontend contributors, backend contributors, editors, and AI agents use the same rules instead of inventing separate normalization behavior in each repo.

## Authority

Tagging authority is split across the two repos:

1. Backend canonicalization and validation rules
   - `../noticiencias_news_collector/news_collector/taxonomy/tags.yml`
   - `../noticiencias_news_collector/news_collector/taxonomy/orthography.yml`
   - `../noticiencias_news_collector/news_collector/taxonomy/normalizer.py`
2. Frontend content schema
   - `src/content/config.ts`
3. This document
   - explains how those rules relate

The frontend does not define its own alternate canonical tag registry.

## Current Contract

### Frontend Shape

Published posts store tags as:

```yaml
tags:
  - inteligencia artificial
  - energía oscura
```

In the frontend schema:

- `tags` is an array of strings
- the frontend currently trusts those strings at render time
- the frontend does not run a second tag normalizer during build

### Backend Normalization

The backend `TagNormalizer` currently performs:

1. trim, lowercase, and whitespace cleanup
2. hyphen and underscore replacement with spaces
3. orthography correction from `orthography.yml`
4. semantic alias mapping from `tags.yml`
5. accent-insensitive deduplication
6. stop-tag removal
7. length filtering
8. truncation to the configured maximum tag count

The backend validator then returns:

- `is_valid`
- `needs_review`
- `warnings`
- `errors`

## Enforced Current Limits

These values come from `news_collector/taxonomy/normalizer.py` and `tags.yml`:

- maximum tags per article: `8`
- minimum tag length: `3`, unless explicitly whitelisted
- maximum tag length: `40`
- allowed character pattern: `^[a-z0-9áéíóúüñ\\s]+$`

The backend owns these limits. If they change, this doc and any editorial prompts must be updated.

## Editorial Rules

- Tags should represent stable concepts, entities, or fields of study.
- Tags should be normalized before publication; rendering components must not repair them ad hoc.
- New or edited frontend content should usually carry at least one meaningful tag unless there is a deliberate editorial reason not to.
- Categories and tags are separate concepts.
  - `categories` is the editorial section list in frontmatter.
  - `tags` is the free-form concept list.
- For new content, prefer one primary category in `categories`, even though the schema still permits an array for legacy compatibility.

## Forbidden Patterns

- frontend-only alias maps
- component-level tag cleanup
- route-specific tag slug rules that bypass shared permalink helpers
- introducing stop-tag or alias rules in prose only without updating the backend taxonomy config

## Current Enforcement Reality

What is enforced today:

- backend normalization and validation when content flows through the backend publisher
- frontend schema shape through `src/content/config.ts`
- general content/build checks through `npm run validate:content`

What is not fully enforced today:

- frontend-only manual edits can still introduce semantically weak or non-normalized tags unless review catches them
- cross-repo schema parity is tested in the backend repo, but not by a single shared CI pipeline spanning both repos

Those gaps are tracked as follow-up work, not as current guarantees.
