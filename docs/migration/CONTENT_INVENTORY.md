# Content Inventory

## Collections
### `posts`
- **Location**: `src/content/posts`
- **File Type**: Markdown (`.md`)
- **Volume**: ~7 posts (based on initial scan)
- **Schema**:
  - `title`: String
  - `author`: String
  - `date`: DateTime
  - `excerpt`: String (Multi-line)
  - `categories`: List<String>
  - `tags`: List<String>
  - `image`: String (Path)
  - `image_alt`: String
  - `translation_method`: String (e.g., "humana")
  - `editorial_score`: Number
  - `review_status`: String
  - `confidence`: String
  - `featured`: Boolean
  - `why_it_matters`: List<String>
  - `sources`: List<Object> { title, url, publisher, date }
  - `permalink`: String (CRITICAL: Used for routing)

## Taxonomies
- **Categories**: editorial, salud, tecnologia, ciencia (inferred from `dist` folders)
- **Tags**: noticiencias, editorial (inferred from frontmatter)

## Pages
- `src/pages/index.astro` (Assumption: Home)
- `src/pages/about.md` or similar (Need to verify static pages)
