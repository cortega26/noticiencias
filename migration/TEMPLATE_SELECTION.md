# Template Selection Record

## Directive
Select a maintained Astro template suitable for a news/editorial site with:
- Pagination & Taxonomy
- Editorial Modules
- SEO & Accessibility
- Active Maintenance

## Candidates Evaluated
1.  **`onwidget/astrowind`** (Selected)
    - **Pros**: comprehensive widget system (Hero, BlogLatestPosts, Content), excellent SEO, Tailwind-based, active community, supports "landing page" style hybrid with blog.
    - **Cons**: Can be feature-heavy (needs pruning).
    - **Fit**: High. It allows building the "Nice-to-have" homepage modules (Lead story, features) out of the box.

2.  **`satnaing/astro-paper`**
    - **Pros**: Excellent typography, minimal, fast, good text experience.
    - **Cons**: Primarily a linear blog list. Would require building "editorial modules" from scratch.
    - **Fit**: Medium. Good for reading, less good for "portal" feel.

## Decision
**Selected: AstroWind (`onwidget/astrowind`)**

### Rationale
AstroWind provides the "UI Layer" architecture we need. Its component library (`src/components/widgets`) maps directly to the requirement for "editorial modules" (Lead story, Trending, Sections). It uses Tailwind (which is standard) and has robust SEO foundations.

### Next Steps
1.  Clone to `vendor/astro-news/`.
2.  Prune "Landing Page" specific generic business widgets.
3.  Map our Content Collection `posts` to its `blog` collection schema.
