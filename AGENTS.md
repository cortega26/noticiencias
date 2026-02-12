# AGENTS.md — Noticiencias Front-End (Astro)

> **Audience:** AI agents, front-end engineers, and content maintainers  
> **Purpose:** Binding constitution for this repository.  
> **Status:** Non-negotiable. Must be read before any action.

---

## 0) Mandatory Preflight (NON-NEGOTIABLE)

Before performing **any** action (analysis, coding, refactors, suggestions):

1. Read this document **entirely**.
2. Identify which sections apply.
3. Ensure compliance with:
   - Architecture
   - Contracts & schemas
   - Regression guardrails
   - Change control

Partial solutions, undocumented assumptions, or “temporary fixes” are **forbidden**.

---

## 1) Architecture Snapshot

### Tech Stack

- Framework: Astro 5.x (SSG only)
- Styling: Tailwind CSS 3.x + `@tailwindcss/typography`
- Theme: Astrowind (customized)
- Content: MDX collections (`src/content/`)
- Language: TypeScript (strict)
- Testing: Vitest
- Linting: ESLint

### Directory Structure (Authoritative)

    /
    ├── src/
    │   ├── components/   # Atomic & composable UI components
    │   ├── content/      # MDX content + config.ts (schemas)
    │   ├── layouts/      # Page/layout shells
    │   ├── pages/        # File-based routing
    │   ├── styles/       # Global styles & Tailwind layers
    │   └── utils/        # Pure helpers (dates, permalinks, SEO)
    ├── public/           # Static assets
    └── astro.config.mjs  # Core configuration

Any deviation requires explicit justification.

---

## 2) Contracts & Schemas (STRICT)

### 2.1 Content Frontmatter Contract (v1)

All posts in `src/content/post/` must comply with the schema in `src/content/config.ts`.

Example frontmatter:

    title: "Article Title"
    description: "SEO meta description (150–160 chars)"
    publishDate: 2024-01-01T00:00:00Z
    image: "~/assets/images/cover.jpg"
    category: "Science"
    tags: ["space", "nasa"] # Lowercase, strict contract (see docs/tagging.md)
    draft: false

Rules:

- `publishDate` must be valid ISO-8601
- `image` must exist locally
- No undocumented fields allowed

### 2.2 Component Interfaces

- Reusable components must define explicit TypeScript interfaces
- No implicit `any`
- Breaking component contracts is a **high-risk change**

---

## 3) Agent Roles & Boundaries

| Role        | Allowed Scope                   |
| ----------- | ------------------------------- |
| Architect   | Config, dependencies, structure |
| Designer    | Tailwind, CSS, UI components    |
| Content Ops | MDX, links, images, metadata    |
| QA/Auditor  | Tests, SEO, validation          |

Operating outside the assigned role requires explicit approval.

---

## 4) Workflows (REQUIRED)

### Development

    npm run dev

### Validation (MANDATORY)

    npm run lint
    npm run validate:content
    npm run test:audit

All must pass.

### Production Preview

    npm run build
    npm run preview

---

## 5) Regression Guardrails (CORE)

### RG1 — Visual Integrity

- Mobile (375px) and Desktop (1280px) verification required

### RG2 — SEO Sanctity (CRITICAL)

Each page must include:

- Unique `<title>`
- `<meta name="description">`
- Canonical link to production URL
- OpenGraph tags

### RG3 — Content Integrity

- No broken links
- No missing images
- Valid dates only

### RG4 — Zero Console Errors

- No build warnings
- No hydration errors
- No 404s

### RG5 — Asset Optimization

- No large raw images
- Use Astro Image pipeline
- All images require `alt` text

---

## 6) Change Control Matrix

| Change Type  | Risk     | Requirements        | Auto |
| ------------ | -------- | ------------------- | ---- |
| Content typo | Low      | None                | Yes  |
| New post     | Low      | Schema validation   | Yes  |
| CSS refactor | High     | Visual verification | No   |
| Layout logic | High     | Full preview        | No   |
| Config/deps  | Critical | Full test suite     | No   |

When in doubt, assume higher risk.

---

## 7) Forbidden Anti-Patterns

- “Quick fix”
- “Temporary workaround”
- “We’ll clean this later”
- Silent behavior changes
- Partial solutions

These invalidate the work.

---

## 8) Deliverables Discipline

Non-trivial changes must include:

- Clear diff scope
- Regression impact
- Validation steps performed

---

## 9) Final Authority

- This file is the highest authority for agent behavior
- Conflicts are resolved in favor of this document
- Work done without reading this file is invalid

---

END OF AGENTS.md
