# Template Diff Analysis

## Dependency Gaps

The following packages are used in **AstroWind** (`vendor/astro-news/`) but missing in `noticiencias`:

### Critical (UI/System)
- **`tailwindcss`**, **`@astrojs/tailwind`**: core styling engine.
- **`@fontsource-variable/inter`**: primary font.
- **`astro-icon`**: used ubiquitously for icons in AstroWind.
- **`astro-embed`**: for video/tweet embeds (useful for news).

### Utilities
- **`reading-time`**: for post metadata.
- **`lodash.merge`**: config merging.
- **`limax`**: slug generation (we might keep our own logic).

### Structure/SEO
- **`@astrolib/seo`**: AstroWind's SEO solution. (We have a plan to build `src/components/SEO.astro`, we should evaluate if we just wrap this or build custom).
- **`@astrolib/analytics`**: analytics wrapper.

## Action Items for Integration
1.  **Install Tailwind**: `npx astro add tailwind` (or manual install).
2.  **Install Icons**: `npm install astro-icon`.
3.  **Adopt/Reject SEO**: Evaluate `@astrolib/seo` vs custom. Custom is often safer for migration parity.

## Directory Structure Diff (Inferred)
AstroWind uses:
- `src/components/widgets/`: Modular UI blocks (Hero, Content, etc.)
- `src/layouts/PageLayout.astro`: Standard layout.
- `src/navigation.js`: Data file for menus.

We will map these to:
- `src/components/template/` (as per plan).
