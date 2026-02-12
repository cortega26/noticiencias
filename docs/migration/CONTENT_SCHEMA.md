# Content Schema Alignment

## Comparison

| Field | Our Schema (`src/content/posts`) | Template Schema (`vendor/astro-news`) | Alignment Strategy |
|:---|:---|:---|:---|
| **Title** | `title` | `title` | Direct map. |
| **Date** | `date` | `publishDate` | Map `date` -> `publishDate`. |
| **Updated** | N/A (implied) | `updateDate` | Optional. |
| **Excerpt** | `excerpt` | `excerpt` | Direct map. |
| **Image** | `image` | `image` | Direct map. Ensure path resolution works. |
| **Category** | `categories` (Array) | `category` (String) | Template assumes single category. **Action**: Use first category as primary for visual label; keep array for logic/SEO. |
| **Tags** | `tags` (Array) | `tags` (Array) | Direct map. |
| **Author** | `author` | `author` | Direct map. |
| **Featured** | `featured` (Boolean) | N/A (uses metadata?) | **Action**: Use `featured` to populate "Lead Story" or "Hero" widget. |
| **Metadata** | Flat fields | `metadata` object | **Action**: We will likely stick to flat fields for simplicity and map them to the `SEO` component props, rather than refactoring 100+ MD files to use a nested object. |
| **Routing** | `permalink` | N/A (file-based) | **CRITICAL**: We MUST preserve `permalink` usage for `getStaticPaths`. |

## Proposed unified Zod Schema
```typescript
z.object({
    title: z.string(),
    date: z.date(), // Map to publishDate in UI
    excerpt: z.string().optional(),
    image: z.string().optional(),
    image_alt: z.string().optional(), // Keep ours
    categories: z.array(z.string()), // Keep array !
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    featured: z.boolean().optional(), // For homepage logic
    permalink: z.string(), // The Source of Truth for URLs
})
```
