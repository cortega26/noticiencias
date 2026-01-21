# AGENTS.md — Noticiencias Front-End (Astro)

> **Audience:** AI agents, front-end engineers, and content maintainers.
> **Purpose:** Define the "Constitution" of the Front-End repository to ensure quality, performance, and stability during autonomous or assisted evolution.

---

## 0) Architecture Snapshot

**Tech Stack:**

- **Framework:** Astro 5.x (SSG Mode)
- **Styling:** Tailwind CSS 3.x + `@tailwindcss/typography`
- **Theme Engine:** Astrowind (customized)
- **Content:** MDX Collections (`src/content/`)
- **Integration:**
  - `@astrojs/sitemap`: SEO
  - `astro-icon`: SVG Management
  - `vitest`: Unit/Integration Testing
  - `eslint`: Code Quality

**Directory Structure:**

```
/
├── src/
│   ├── components/  # Atomic UI components
│   ├── content/     # MDX posts and config.ts (Schema)
│   ├── layouts/     # Page shells (PageLayout, Metadata)
│   ├── pages/       # File-based routing (.astro, .md)
│   ├── styles/      # Global CSS & Tailwind base
│   └── utils/       # Helpers (permalinks, dates)
├── public/          # Static assets (favicons, robots.txt)
└── astro.config.mjs # Core configuration
```

---

## 1) Shared Contracts & Schemas

### Content Frontmatter (v1)

All posts in `src/content/post/` must adhere to the schema defined in `src/content/config.ts`.

```yaml
title: "Article Title"
description: "SEO Meta Description (150-160chars)"
publishDate: 2024-01-01T00:00:00Z
image: "~/assets/images/cover.jpg" # Local optimized asset
category: "Science"
tags: ["Space", "NASA"]
draft: false
```

### Component Props

All highly reusable components (Buttons, Cards, Headers) MUST interface via TypeScript interfaces exported or defined in the component frontmatter `---`.

---

## 2) Agent Roles & Responsibilities

| Role            | Responsibility                                               | Tools                                                 |
| :-------------- | :----------------------------------------------------------- | :---------------------------------------------------- |
| **Architect**   | Config updates, Dependency management, Structure refactoring | `astro.config.mjs`, `package.json`                    |
| **Designer**    | CSS changes, Tailwind config, Component UI updates           | `tailwind.config.mjs`, `src/components`, `src/styles` |
| **Content Ops** | Markdown fixes, Broken link resolution, Image optimization   | `src/content`, `public/images`                        |
| **QA Bot**      | Running audits, Checking SEO, verifying links                | `vitest`, `lighthouse`, `SEO_CHECKLIST.md`            |

---

## 3) Workflows

### W1: Development

```bash
npm run dev
```

- Starts local server on `http://localhost:4321`.
- Hot Module Replacement (HMR) active.

### W2: Validation (Required before PR)

```bash
npm run lint          # Check code style
npm run validate:content # Sync types and check content schemas
npm run test:audit    # Run Vitest suite
```

### W3: Production Preview

```bash
npm run build && npm run preview
```

- Generates static files in `dist/`.
- Serves `dist/` locally to verify final build artifacts.

---

## 4) **REGRESSION GUARDRAILS (CORE SECTION)**

### RG1 --- Visual Integrity

- **Rule:** No style change is "safe" until verified on Mobile (375px) and Desktop (1280px).
- **Enforcement:** Agents must verify layout shift or breakage. If possible, request a snapshot or manual user review for CSS refactors.

### RG2 --- SEO Sanctity

- **Rule:** Breaking SEO metadata is a **Critical Severity** regression.
- **Mandatory Checks per Page:**
  - `<title>` exists and is unique.
  - `<meta name="description">` is populated.
  - `<link rel="canonical">` points to the absolute production URL.
  - OpenGraph (`og:image`, `og:title`) tags are present.

### RG3 --- Content Integrity

- **Rule:** No "dead ends".
- **Checks:**
  - Internal links must resolve to existing pages.
  - Images must exist.
  - Frontmatter `publishDate` must be valid ISO.

### RG4 --- Zero Console Errors

- **Rule:** The build log must be clean of **Warnings** regarding content or types.
- **Rule:** The browser console in Dev/Preview must be free of Hydration Errors or 404s.

### RG5 --- Asset Optimization

- **Rule:** Do not commit raw MB-sized images.
- **Action:** Use Astro's `<Image />` component or `optimum` library.
- **Alt Text:** ALL images require descriptive `alt` text.

---

## 5) Change Control & Risk Matrix

| Change Type             | Risk Level | Required Review     | Auto-Approvable? |
| :---------------------- | :--------- | :------------------ | :--------------- |
| **Content (Typo/Text)** | Low        | None                | ✅ Yes           |
| **CSS Refactor**        | High       | Visual Verification | ❌ No            |
| **Layout Logic**        | High       | Visual + Smoke Test | ❌ No            |
| **Config/Dependencies** | Critical   | Full Test Suite     | ❌ No            |
| **New Post**            | Low        | Validator Check     | ✅ Yes           |

---

## 6) Deliverables & Checklists

### New Feature Checklist

- [ ] Responsive on Mobile/Desktop?
- [ ] Accessible (Colors, Keyboard nav, Alt text)?
- [ ] No new ESLint errors?

### Refactor Checklist

- [ ] `npm run build` passes?
- [ ] No regression in Core Web Vitals (LCP/CLS)?
- [ ] URLs preserved or redirected?

---

**End of AGENTS.md**
