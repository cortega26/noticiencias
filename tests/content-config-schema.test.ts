import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'astro/zod';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
}));

import { collections } from '../src/content.config';

const schema = (collections.posts as unknown as { schema: z.ZodTypeAny }).schema;

const basePost = {
  title: 'A valid post title',
  excerpt: 'A sufficiently long excerpt',
  date: new Date('2026-01-01'),
  image: '/images/hero.jpg',
  image_alt: 'A description of the hero image',
};

describe('content.config posts schema', () => {
  const originalStrictEditorial = process.env.STRICT_EDITORIAL;

  afterEach(() => {
    if (originalStrictEditorial === undefined) delete process.env.STRICT_EDITORIAL;
    else process.env.STRICT_EDITORIAL = originalStrictEditorial;
  });

  it('accepts a minimal valid post', () => {
    expect(schema.safeParse(basePost).success).toBe(true);
  });

  it('rejects a post whose image has no alt text anywhere', () => {
    const result = schema.safeParse({ ...basePost, image_alt: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('image_alt'))).toBe(true);
  });

  it('accepts inline image alt text as an alternative to image_alt', () => {
    const result = schema.safeParse({
      ...basePost,
      image_alt: undefined,
      image: { src: '/images/hero.jpg', width: 800, height: 600, alt: 'Inline alt' },
    });
    expect(result.success).toBe(true);
  });

  it('requires featured_rank when featured is true', () => {
    const result = schema.safeParse({ ...basePost, featured: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('featured_rank'))).toBe(true);
  });

  it('accepts featured posts that provide a featured_rank', () => {
    const result = schema.safeParse({ ...basePost, featured: true, featured_rank: 1 });
    expect(result.success).toBe(true);
  });

  describe('STRICT_EDITORIAL enforcement for schema_version >= 2', () => {
    beforeEach(() => {
      process.env.STRICT_EDITORIAL = 'true';
    });

    it('rejects a v2 post missing every editorial field', () => {
      const result = schema.safeParse({ ...basePost, schema_version: 2 });
      expect(result.success).toBe(false);
      const paths = result.error?.issues.map((i) => i.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining([
          'summary_points',
          'glossary',
          'fact_check',
          'why_it_matters',
          'confidence',
          'sources',
        ])
      );
    });

    it('accepts a v2 post with every required editorial field present', () => {
      const result = schema.safeParse({
        ...basePost,
        schema_version: 2,
        summary_points: ['Point one', 'Point two'],
        glossary: [{ term: 'Term', definition: 'Definition' }],
        fact_check: [{ label: 'Claim', status: 'verified' }],
        why_it_matters: ['Because it matters'],
        confidence: 'high',
        sources: [{ title: 'Source', url: 'https://example.com' }],
      });
      expect(result.success).toBe(true);
    });

    it('does not enforce editorial fields for schema_version 1 even when strict', () => {
      const result = schema.safeParse({ ...basePost, schema_version: 1 });
      expect(result.success).toBe(true);
    });
  });

  it('does not enforce editorial fields for v2 posts when STRICT_EDITORIAL is not set', () => {
    delete process.env.STRICT_EDITORIAL;
    const result = schema.safeParse({ ...basePost, schema_version: 2 });
    expect(result.success).toBe(true);
  });
});
