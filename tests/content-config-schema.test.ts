import { describe, expect, it, vi } from 'vitest';
import type { z } from 'astro/zod';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
}));

import { collections } from '../src/content.config';

const schema = (collections.posts as unknown as { schema: z.ZodTypeAny }).schema;

type ParsedPost = { social?: { publish: boolean; id?: string } };

const basePost = {
  title: 'A valid post title',
  excerpt: 'A sufficiently long excerpt',
  date: new Date('2026-01-01'),
  image: '/images/hero.jpg',
  image_alt: 'A description of the hero image',
};

describe('content.config posts schema', () => {
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

  describe('editorial field enforcement for schema_version >= 2', () => {
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

    it('does not enforce editorial fields for schema_version 1', () => {
      const result = schema.safeParse({ ...basePost, schema_version: 1 });
      expect(result.success).toBe(true);
    });
  });

  describe('social distribution config', () => {
    const hexId = 'a'.repeat(64);

    it('accepts a post with no social block', () => {
      expect(schema.safeParse(basePost).success).toBe(true);
    });

    it('keeps a valid social block instead of stripping it', () => {
      const result = schema.safeParse({
        ...basePost,
        social: { publish: true, id: hexId },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as ParsedPost).social).toEqual({ publish: true, id: hexId });
      }
    });

    it('defaults social.publish to false when only an id is given', () => {
      const result = schema.safeParse({ ...basePost, social: { id: hexId } });
      expect(result.success).toBe(true);
      if (result.success) expect((result.data as ParsedPost).social?.publish).toBe(false);
    });

    it('requires a non-empty social.id when social.publish is true', () => {
      const result = schema.safeParse({ ...basePost, social: { publish: true } });
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((i) => i.path.join('.') === 'social.id')).toBe(true);
    });

    it('rejects a malformed social.id', () => {
      const result = schema.safeParse({
        ...basePost,
        social: { publish: false, id: 'NOT-HEX' },
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((i) => i.path.includes('id'))).toBe(true);
    });

    it('rejects unknown keys inside social', () => {
      const result = schema.safeParse({
        ...basePost,
        social: { publish: true, id: hexId, channel: 'x' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an explicit social: null', () => {
      const result = schema.safeParse({ ...basePost, social: null });
      expect(result.success).toBe(false);
    });
  });
});
