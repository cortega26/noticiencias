import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        excerpt: z.string().optional(),
        author: z.string().default('Noticiencias'),
        date: z.date(),
        categories: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        image: z.string().optional(), // Keeping as string for now (public/assets)
        image_alt: z.string().optional(),
        permalink: z.string().optional(), // For legacy URL compatibility

        // Custom Noticiencias fields
        translation_method: z.string().optional(),
        editorial_score: z.number().optional(),
        review_status: z.string().optional(),
        confidence: z.string().optional(),
        investigation: z.boolean().default(false),
        featured: z.boolean().default(false),

        fact_check: z.array(z.object({
            label: z.string(),
            status: z.string()
        })).optional(),

        why_it_matters: z.array(z.string()).optional(),

        sources: z.array(z.object({
            title: z.string(),
            url: z.string().url(),
            publisher: z.string().optional(),
            date: z.string().optional()
        })).optional(),
    }),
});

export const collections = { posts };
