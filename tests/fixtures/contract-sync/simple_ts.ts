import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),

  schema: z.object({
    title: z.string().min(5),
    excerpt: z.string().min(10),
    author: z.string().default('Noticiencias'),
    categories: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    source_url: z.url().optional(),
    sources: z
      .array(
        z.object({
          title: z.string().min(1),
          url: z.url(),
          publisher: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export const collections = { posts };
