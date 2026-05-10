import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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

      source_url: z.string().url().optional(),
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
      featured: z.boolean().default(false),

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
            url: z.string().url(),
            publisher: z.string().optional(),
            date: z.string().optional(),
          })
        )
        .optional(),
    })
    .superRefine((data, ctx) => {
      const objectAlt = typeof data.image === 'object' ? data.image.alt?.trim() : '';
      const frontmatterAlt = data.image_alt?.trim() ?? '';
      if (!objectAlt && !frontmatterAlt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['image_alt'],
          message: 'image_alt is required when image does not include inline alt text',
        });
      }
    }),
});

export const collections = { posts };
