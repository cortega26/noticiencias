import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),

  schema: z
    .object({
      title: z.string().min(5, 'Title too short'),
      schema_version: z.number().int().min(1).default(1),
      excerpt: z.string().min(10, 'Excerpt too short'),
      author: z.string().default('Noticiencias'),
      date: z.date(),
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),

      image: z.union([
        z.string(),
        z.object({
          src: z.string(),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          alt: z.string().optional(),
        }),
      ]),
      image_alt: z.string().optional(),
      permalink: z.string().optional(),

      source_url: z.url().optional(),
      refinery_id: z.string().optional(),
      headlines_variants: z
        .object({
          question: z.string().optional(),
          benefit: z.string().optional(),
        })
        .optional(),

      translation_method: z.string().optional(),
      editorial_score: z.number().optional(),
      review_status: z.string().optional(),
      confidence: z.string().optional(),
      investigation: z.boolean().default(false),
      requires_uncertainty_note: z.boolean().default(false),
      featured: z.boolean().default(false),
      featured_rank: z.number().int().positive().optional(),
      summary_points: z.array(z.string().min(1)).min(2).max(5).optional(),
      uncertainty_note: z.string().optional(),
      glossary: z
        .array(
          z.object({
            term: z.string().min(1),
            definition: z.string().min(1),
          })
        )
        .optional(),

      fact_check: z
        .array(
          z.object({
            label: z.string(),
            status: z.string(),
          })
        )
        .optional(),

      why_it_matters: z.array(z.string()).optional(),
      series: z.string().optional(),

      sources: z
        .array(
          z.object({
            title: z.string().min(1),
            url: z.url(),
            publisher: z.string().optional(),
            date: z.string().optional(),
          })
        )
        .optional(),
    })
    .superRefine((data, ctx) => {
      // --- image_alt cross-field validation ---
      const objectAlt = typeof data.image === 'object' ? data.image.alt?.trim() : '';
      const frontmatterAlt = data.image_alt?.trim() ?? '';
      if (!objectAlt && !frontmatterAlt) {
        ctx.addIssue({
          code: 'custom',
          path: ['image_alt'],
          message: 'image_alt is required when image does not include inline alt text',
        });
      }

      // --- featured_rank cross-field validation ---
      if (data.featured === true && !data.featured_rank) {
        ctx.addIssue({
          code: 'custom',
          path: ['featured_rank'],
          message: 'featured_rank is required when featured is true',
        });
      }

      // --- Editorial enrichment enforcement (schema_version >= 2) ---
      // Progressive contract: v1 posts are grandfathered; v2+ require structured editorial fields.
      // Gate: STRICT_EDITORIAL=true enables blocking enforcement (CI). In dev, the standalone
      // script scripts/check-editorial-fields.js still surfaces issues without blocking builds.
      const strictEditorial = process.env.STRICT_EDITORIAL === 'true';
      if (strictEditorial && data.schema_version && data.schema_version >= 2) {
        // summary_points: 2-5 non-empty strings
        if (!data.summary_points || data.summary_points.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['summary_points'],
            message:
              'summary_points is required for schema_version >= 2 (2-5 items)',
          });
        } else if (data.summary_points.length < 2 || data.summary_points.length > 5) {
          ctx.addIssue({
            code: 'custom',
            path: ['summary_points'],
            message: `summary_points must have 2-5 items (got ${data.summary_points.length})`,
          });
        }

        // glossary: at least 1 {term, definition}
        if (!data.glossary || data.glossary.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['glossary'],
            message: 'glossary is required for schema_version >= 2 (≥1 item)',
          });
        }

        // fact_check: at least 1 {label, status}
        if (!data.fact_check || data.fact_check.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['fact_check'],
            message: 'fact_check is required for schema_version >= 2 (≥1 item)',
          });
        }

        // why_it_matters: at least 1 string
        if (!data.why_it_matters || data.why_it_matters.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['why_it_matters'],
            message:
              'why_it_matters is required for schema_version >= 2 (≥1 item)',
          });
        }

        // confidence: required string
        if (!data.confidence) {
          ctx.addIssue({
            code: 'custom',
            path: ['confidence'],
            message: 'confidence is required for schema_version >= 2',
          });
        }

        // sources: at least 1 {title, url}
        if (!data.sources || data.sources.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['sources'],
            message: 'sources is required for schema_version >= 2 (≥1 item)',
          });
        }
      }
    }),
});

export const collections = { posts };
