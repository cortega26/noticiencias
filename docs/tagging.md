# Tagging Policy & Technical Contract

> **Status**: APPROVED (v1.0)
> **Applies to**: All content agents, editors, and backend pipelines.

This document defines the **schema**, **contracts**, and **policies** for tagging in the Noticiencias ecosystem.

---

## 1. Core Principles

1.  **Repo-Truth**: Tags are defined by usage in the content repository (`src/content/posts`). We do not maintain an external database of valid tags, but we enforce strict formatting.
2.  **Semantic Value**: Tags must represent **stable concepts** (entities, fields of study, technologies), not transient phrases or clickbait.
3.  **Flat Hierarchy**: Tags are non-hierarchical. Categories (Science, Technology, Health) are distinct and mutually exclusive.
4.  **Automated Hygiene**: The pipeline automatically sanitizes input. If it cannot guarantee a valid tag, it flags for human review (`needs_tag_review`).

---

## 2. Technical Contract

All tags MUST satisfy the following invariants. Any tag violating these will be either **sanitized automatically** or **rejected**.

### 2.1 Format & Syntax (The "Sanitizer" Contract)

| Constraint        | Rule                               | Example (Bad -> Good)                              |
| :---------------- | :--------------------------------- | :------------------------------------------------- |
| **Case**          | Always lowercase.                  | `NASA` -> `nasa`, `SpaceX` -> `spacex`             |
| **Whitespace**    | Trimmed, single internal spaces.   | `black hole` -> `black hole`                       |
| **Separators**    | Hyphens/Underscores become spaces. | `dark-energy` -> `dark energy`                     |
| **Accents**       | Preserved (Spanish grammar rules). | `astronomia` -> `astronomía` (if correction known) |
| **Length**        | Min 3 chars (unless whitelisted).  | `ai` (whitelist) vs `x` (invalid)                  |
| **Allowed Chars** | `a-z`, `0-9`, `áéíóúüñ`, space.    | `C++` -> `cpp` (via alias), `user@mail` -> invalid |

### 2.2 Quantity & Scope

- **Min Tags**: 1 per article.
- **Max Tags**: 8 per article (soft limit), 10 (hard limit).
- **Stop Tags**: Generic terms are FORBIDDEN.
  - Forbidden: `other`, `misc`, `varios`, `general`, `news`, `article`.

### 2.3 Semantic Aliasing

We use a `tags.yml` configuration to map known variations to a canonical form:

- **Synonyms**: `ai` -> `inteligencia artificial`
- **Translations**: `artificial intelligence` -> `inteligencia artificial`
- **Acronyms**: `llm` -> `grandes modelos de lenguaje` (context dependent, generally prefer expanded unless term is ubiquitous like 'dna'/'adn').

---

## 3. Workflow & Automation

### 3.1 Content Pipeline (LLM/Editor)

The AI Editor is the **first line of defense**. It must:

1.  **Generate** candidate tags based on article content.
2.  **Consult** the `alias_map` (via injected prompt context if possible, or implicitly).
3.  **Output** a list of strings that _attempt_ to comply with the contract.

### 3.2 The Sanitizer (Runtime)

The `TagNormalizer` runs immediately after generation. It performs **idempotent, mechanical fixes**:

- `Strip()` + `Lower()`
- `Replace('-', ' ')`
- `Map(Alias)`
- `Dedupe()` (case-insensitive + accept canonical)

### 3.3 The Validator (Gatekeeper)

The `TagValidator` runs after sanitization. It checks the **Final** state:

- **WARNING**: If count > 8 (we truncate to 8).
- **ERROR/NEEDS_REVIEW**:
  - Contains characters outside allowed set (e.g., emojis, punctuation).
  - Contains "Forbidden" tags (`other`).
  - Tag length < 2 or > 40.

If validation fails with `needs_tag_review`, the pipeline **must not** publish automatically (fail-closed or flag).

---

## 4. Categories vs. Tags (Clarification)

- **Categories**: EXACTLY ONE of `{Ciencia, Tecnología, Salud, Editorial}`.
- **Tags**: 0..N concepts.

**Never** use a category name as a tag (e.g., do not tag an article "Ciencia").

---

## 5. Maintenance

- **Config**: `news_collector/taxonomy/tags.yml` is the Source of Truth for aliases and stop tags.
- **Backfill**: We provide `tools/backfill_tags.py` to retroactively clean content if the contract changes.
