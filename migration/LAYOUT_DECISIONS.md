# Layout Decisions

## UI Architecture
- **BaseLayout**: Adopted pattern from AstroWind's `PageLayout.astro`. It serves as the main shell for the site, providing:
    - `Header` (Sticky, with Theme Toggle)
    - `Announcement` slot
    - `<main>` content area
    - `Footer`
- **Template Layouts**: Moved to `src/layouts/template/` to avoid naming conflicts and allow gradual migration.
- **Components**: Moved to `src/components/template/` to segregate new UI from legacy.

## Global Styles
- **Tailwind**: Configured via `src/styles/global.css` and `tailwind.config.mjs`.
- **CustomStyles**: Ported `CustomStyles.astro` to `src/components/template/CustomStyles.astro` to handle CSS variables (colors, fonts).

## Data
- **Navigation**: Ported `src/navigation.ts` to drive Header and Footer data.
- **Metadata**: Using AstroWind's `Metadata` component structure (mapped via `BaseLayout` props).
