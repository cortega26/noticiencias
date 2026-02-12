# Route Mapping

## Core Routing
| Route Type | Existing Path | Template Path | Action |
|:---|:---|:---|:---|
| **Home** | `/` | `/` | Replace UI. Map template homepage modules to our content. |
| **Post** | `/<permalink>/` | `/get-started-website-with-astro-tailwind-css/` | **CRITICAL**: Keep our `permalink` logic. |
| **Tag** | `/tags/[tag]/` | `/tag/[tag]/` | **Deviation**: Template uses `/tag/` (singular). We must decide: KEEP `/tags/` (plural) to avoid heavy redirects. |
| **Category** | `/categories/[category]/` | `/category/[category]/` | **Deviation**: Template uses `/category/`. We should KEEP `/categories/` (plural) for backward compatibility. |
| **RSS** | `/rss.xml` | `/rss.xml` | Keep existing endpoint. |
| **Sitemap** | `/sitemap-index.xml` | `/sitemap-index.xml` | Keep existing endpoint. |

## Strategy
1.  **Posts**: Use our existing `[...slug].astro` or `[...blog].astro` but configured to respect `permalink` frontmatter above all else.
2.  **Archives**: Rename template's `src/pages/category/[category].astro` to `src/pages/categories/[category].astro` to match our plural URL convention. Same for `tags`.

## Redirects
- Target: **Zero redirects**. We will modify the template routing to match *us*, not the other way around.
