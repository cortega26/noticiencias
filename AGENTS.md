# AGENTS.md — Noticiencias Front-End (Astro)

Status: Active and binding
Audience: AI agents, front-end engineers, and content maintainers
Scope: `/home/carlos/VS_Code_Projects/noticiencias/noticiencias`

This file is an engineering governance document for code review and autonomous edits. It is not a style guide and it is not aspirational. If a rule here conflicts with convenience, convenience loses.

## 0) Mandatory Preflight

Before making any change:

1. Read this file fully.
2. Inspect the touched code paths, not just the target file.
3. Classify the change using the change matrix in Section 9.
4. Run the required validation for that class of change.

Do not ship "temporary", "follow-up", or "cleanup later" solutions. If the change needs a second step to be safe, the task is not complete.

## 1) Repo Reality

The front-end is a static Astro site with MDX content and server-first rendering.

Current architectural pillars:

- `src/content/posts/`: content source of truth for published articles.
- `src/content/config.ts`: frontmatter contract for the `posts` collection.
- `src/pages/`: route entrypoints and static path generation.
- `src/layouts/`: page shells and metadata composition.
- `src/components/ds/`: Noticiencias-specific design-system primitives and article UI.
- `src/components/template/`: Astrowind-derived site shell, widgets, and shared template pieces.
- `src/utils/`: reusable data and URL helpers. These must stay mostly pure.

The repo currently has two UI layers: `ds` and `template`. They are not interchangeable. New work must preserve that boundary instead of blending both systems into an unstructured component pool.

## 2) Architectural Laws

### LAW-F1: Content schema is sealed

The only authoritative post schema is `src/content/config.ts`.

Rules:

- New or modified posts must satisfy the current `posts` schema exactly.
- Governance text must reflect the real fields in code, not a hypothetical schema.
- Frontmatter fields currently in active use include `title`, `schema_version`, `excerpt`, `author`, `date`, `categories`, `tags`, `image`, `image_alt`, `permalink`, and the Noticiencias editorial metadata defined in `src/content/config.ts`.
- Do not introduce undocumented frontmatter fields without updating the schema first.
- Do not re-interpret schema defaults as product behavior. If a field is defaulted for legacy compatibility, new content still needs explicit editorial intent.

Review trigger:

- Any change to `src/content/config.ts` is high risk and must be treated as a cross-repo contract change because the backend publishes into this schema.

### LAW-F2: Route, layout, and component responsibilities are fixed

Rules:

- `src/pages/` may load data, call `getCollection`, compute `getStaticPaths`, and assemble page metadata.
- `src/pages/` must not become a dumping ground for repeated view logic. If markup or script is needed by more than one route, extract it.
- `src/layouts/` own page chrome, document metadata plumbing, and shared structural wrappers.
- `src/layouts/` must not contain collection querying, taxonomy normalization, or ad hoc content repair logic.
- `src/components/ds/` are presentational building blocks for the Noticiencias UI. They must accept typed props and remain route-agnostic.
- `src/components/template/` own the Astrowind shell and legacy widget system. They may compose `ds` pieces when useful; `ds` components must not import `template` components.
- `src/components/common/` is for site-specific reusable fragments that do not fit the `ds` atom/molecule/organism taxonomy.

Reject in review:

- A page importing low-level browser helpers and DOM logic directly when a component should own it.
- A layout repairing malformed content or parsing frontmatter strings.
- A `ds` component importing from `components/template/`.

### LAW-F3: Server-first rendering is the default

Rules:

- Default to plain Astro rendering.
- Do not add a hydrated UI island or a new client framework dependency unless the interaction cannot be delivered with static HTML plus a tightly scoped script.
- Browser globals such as `window`, `document`, `localStorage`, and `history` must never be referenced in Astro frontmatter or shared server code.
- Browser-only helpers belong in explicit browser-only modules or inline scripts attached to the owning component/page.
- Scripts used on routed pages must be idempotent across Astro page transitions.

Review trigger:

- Any new `client:*` directive, view-transition behavior change, or cross-page script bootstrap is high risk.

### LAW-F4: State ownership must stay local and obvious

Rules:

- If state is only needed for one component, keep it in that component's script.
- If state is shared across a page, the page or layout owns it.
- Do not invent a global store, event bus, or generic state helper for a single route.
- URL state must use existing permalink/search helpers where possible instead of reimplementing query-string behavior.

Prefer duplication over abstraction when the only reason to extract state logic is "we might reuse this later".

### LAW-F5: Utilities must stay narrow and mostly pure

Rules:

- `src/utils/` is for transformations, parsing, sorting, permalink generation, image helpers, and filesystem-safe helpers.
- A utility must have a single responsibility and a stable name that matches its behavior.
- Do not place DOM manipulation, route composition, or component markup concerns in `src/utils/`.
- If helper logic is specific to posts, search, images, or permalinks, keep it in that domain file rather than a generic catch-all.
- If a helper has only one consumer, keep it local until a second concrete use exists.

Reject in review:

- New `utils.ts` growth for unrelated helpers.
- "shared" helpers that import half the app.
- Utilities that reach into browser globals without being explicitly browser-only.

### LAW-F6: Content normalization belongs before rendering

Rules:

- Content cleanup, schema repair, slug normalization, and duplicate permalink detection belong in content/utils layers, not in presentational components.
- Components may format data for display; they must not fix broken source data.
- If malformed content is discovered during rendering, fix the source or the ingestion contract. Do not embed one-off repair code in a component unless the defect is a documented compatibility shim.

This repo currently contains some defensive rendering logic for legacy content. Do not expand that pattern without documenting the compatibility reason inline.

### LAW-F7: Raw HTML and raw images are controlled escape hatches

Rules:

- `set:html` is allowed only for trusted, intentionally pre-rendered content.
- Do not use `set:html` to avoid creating a component or to inject arbitrary frontmatter strings.
- Any new `set:html` usage must state the trusted source in code comments if it is not obvious from the call site.
- Use the Astro image pipeline or the shared image component by default.
- Raw `<img>` is allowed only when Astro image processing cannot handle the source or when the source is already an external, runtime-only URL.
- Every image needs meaningful `alt` text. Decorative images must use empty alt text intentionally, not by omission.

### LAW-F8: SEO, accessibility, and performance are first-class constraints

Rules:

- Every public page must provide unique title and description metadata through the shared metadata flow.
- Canonical URLs must resolve through the production URL helpers; do not hardcode environment-specific canonicals in individual pages.
- Heading structure must remain ordered and page-specific. Do not skip from `h1` to `h3` for styling.
- Interactive controls must be keyboard reachable and labeled.
- Avoid shipping page-wide scripts when a component-scoped script is sufficient.
- Avoid duplicate collection fetches, duplicate render passes, and repeated expensive parsing in loops.
- Search, blog listing, taxonomy pages, and image-heavy surfaces are performance-sensitive. Prefer precomputed data and deterministic transforms over repeated work during build.

## 3) Contracts That Must Stay Stable

### 3.1 Post contract

All article rendering paths must continue to work with the `posts` collection contract in `src/content/config.ts`.

Additional editorial rules for new or modified posts:

- `date` must be valid and intentional.
- `categories` should contain one primary editorial category for new content, even though the schema currently permits legacy empty arrays.
- `tags` must follow `docs/tagging.md`.
- `image_alt` or `image.alt` must be present.
- `permalink` must not collide with an existing post.

### 3.2 Metadata contract

The shared metadata path is:

- page computes metadata
- layout passes metadata
- `src/components/template/common/Metadata.astro` emits SEO tags

Do not bypass this path unless fixing the metadata path itself.

### 3.3 URL contract

Permalink and taxonomy generation must go through the existing permalink/blog helpers.

Do not:

- hand-roll route strings in multiple files
- duplicate slug cleaning logic
- add route-specific URL normalization that disagrees with `src/utils/permalinks.ts`

## 4) Anti-Patterns Blocked in Review

Reject these changes unless there is an explicit, file-local justification:

- New abstractions with one consumer and no active second use case.
- Generic wrapper components that only rename props.
- Creating a third UI layer instead of deciding between `ds`, `template`, or `common`.
- Putting browser code in `src/utils/` just because it is reused.
- Using `set:html` because typing content as structured props feels slower.
- Repeating permalink, tag, or image normalization logic in components.
- Turning a one-page interaction into global shared infrastructure.
- Mixing design-system tokens and one-off Tailwind values in the same reusable component without clear intent.

## 5) Refactor Triggers

A refactor is required, not optional, when one of these happens:

- The same transform appears in two files.
- A page owns more than one substantial inline script.
- A component both fetches/normalizes data and renders it.
- A helper name becomes generic enough that its scope is no longer clear.
- A route duplicates metadata assembly or canonical URL logic from another route.
- A presentational component starts branching on content schema edge cases.

## 6) Change Heuristics

Use these trade-offs in review:

- Prefer a little duplication over a premature shared abstraction.
- Prefer explicit props over large configuration objects.
- Prefer route-level composition over deeply nested wrapper components.
- Prefer build-time computation over runtime browser work.
- Prefer deleting dead widget variants over supporting every historical option forever.

## 7) Validation Rules

Required baseline commands:

```bash
npm run lint
npm run validate:content
```

Additional commands by change type:

- Content-only changes: baseline commands.
- Component, layout, route, script, metadata, search, or image pipeline changes:

```bash
npm run build
npm run test:dist
npm run test:audit
```

- Dependency, Astro config, Tailwind config, or content schema changes:

```bash
npm run lint
npm run validate:content
npm run build
npm run test:dist
npm run test:audit
```

Manual verification required for visual or interaction changes:

- Mobile width: 375px
- Desktop width: 1280px
- No console errors
- No broken images
- No broken canonical metadata

## 8) Review Checklist

Before considering a change complete, verify:

- The touched files respect the page/layout/component boundaries above.
- No new utility or abstraction was added without a concrete second-use justification.
- Metadata still flows through the shared SEO path.
- Browser code is scoped and idempotent.
- Content normalization did not move into rendering.
- Images, headings, and controls remain accessible.
- Required validation commands for the change class were run.

## 9) Change Matrix

| Change type                                       | Risk     | Minimum requirement                                     |
| ------------------------------------------------- | -------- | ------------------------------------------------------- |
| Content typo or metadata-only post fix            | Low      | `npm run lint && npm run validate:content`              |
| New post or taxonomy/content update               | Medium   | Baseline validation and permalink/metadata sanity check |
| Component or page markup change                   | High     | Full validation plus mobile and desktop verification    |
| Shared layout, metadata, search, or script change | High     | Full validation and regression check on affected routes |
| Content schema, config, or dependency change      | Critical | Full validation; treat as cross-repo contract change    |

When in doubt, choose the higher risk class.

## 10) Final Authority

This file governs agent and reviewer behavior for this repository.

- Work that ignores these rules is incomplete.
- Convenience does not override architectural boundaries.
- Future changes must make the repo easier to reason about, not merely easier to patch.

<claude-mem-context>
# Memory Context

# [noticiencias] recent context, 2026-04-17 6:04pm GMT-4

No previous sessions found.
</claude-mem-context>
