import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    type: 'content',

    schema: z.object({
        title: z.string().min(5, "Title too short"),
        schema_version: z.number().int().min(1).default(1), // Default to 1 for legacy, but we track it now
        excerpt: z.string().min(10, "Excerpt too short"),
        author: z.string().default('Noticiencias'),
        date: z.date(),
        categories: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),

        // Migration: Support legacy strings but prefer object with dimensions
        image: z.union([
            z.string(), // Allow local paths (e.g. /images/...) or URLs
            z.object({
                src: z.string(), // content/images might use relative paths too
                width: z.number().int().positive(),
                height: z.number().int().positive(),
                alt: z.string().optional(),
            })
        ]).optional(), 
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
        series: z.string().optional(),

        sources: z.array(z.object({
            title: z.string().min(1),
            url: z.string().url(),
            publisher: z.string().optional(),
            date: z.string().optional()
        })).optional(),
    }),
});

export const collections = { posts };
