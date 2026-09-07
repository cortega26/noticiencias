import { describe, expect, it, vi } from 'vitest';
import type { z } from 'astro/zod';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
}));

import { collections } from '../../src/content.config';

const schema = (collections.posts as unknown as { schema: z.ZodTypeAny }).schema;

const basePost = {
  title: 'A valid post title',
  excerpt: 'A sufficiently long excerpt',
  date: new Date('2026-01-01'),
  image: '/images/hero.jpg',
  image_alt: 'A description of the hero image',
};

const HEX64 = 'a'.repeat(64);

const parse = (social: unknown) => schema.safeParse({ ...basePost, social });

describe('content.config social contract', () => {
  it('accepts a post with no social key', () => {
    expect(schema.safeParse(basePost).success).toBe(true);
  });

  it('accepts an empty social object (disabled)', () => {
    expect(parse({}).success).toBe(true);
  });

  it('accepts social.publish false without an id', () => {
    expect(parse({ publish: false }).success).toBe(true);
  });

  it('accepts social.publish true with a valid 64-hex id', () => {
    expect(parse({ publish: true, id: HEX64 }).success).toBe(true);
  });

  it('normalizes an absent publish to false via default', () => {
    const result = parse({ id: HEX64 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { social?: unknown }).social).toEqual({ publish: false, id: HEX64 });
    }
  });

  it('rejects the string "true" for publish (no coercion)', () => {
    const result = parse({ publish: 'true' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'social')).toBe(true);
  });

  it('rejects numeric 1 / 0 for publish', () => {
    expect(parse({ publish: 1 }).success).toBe(false);
    expect(parse({ publish: 0 }).success).toBe(false);
  });

  it('rejects social: null (optional, not nullable)', () => {
    expect(parse(null).success).toBe(false);
  });

  it('requires a non-empty id when publish is true', () => {
    const missing = parse({ publish: true });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.some((i) => i.path.join('.') === 'social.id')).toBe(true);

    expect(parse({ publish: true, id: '' }).success).toBe(false);
  });

  it('rejects a malformed id (too short / uppercase / non-hex)', () => {
    expect(parse({ publish: true, id: 'abc' }).success).toBe(false);
    expect(parse({ publish: true, id: 'A'.repeat(64) }).success).toBe(false);
    expect(parse({ publish: false, id: 'g'.repeat(64) }).success).toBe(false);
  });

  it('rejects an id with surrounding whitespace or a trailing newline', () => {
    // Parity guard: Python `re` lets `$` match before a trailing newline, so a
    // mirror implemented with re.search would accept these. Zod must not.
    expect(parse({ publish: true, id: `${HEX64}\n` }).success).toBe(false);
    expect(parse({ publish: true, id: `\n${HEX64}` }).success).toBe(false);
    expect(parse({ publish: true, id: `${HEX64} ` }).success).toBe(false);
    expect(parse({ publish: true, id: ` ${HEX64}` }).success).toBe(false);
  });

  it('rejects unknown keys inside social', () => {
    expect(parse({ publish: true, id: HEX64, channel: 'facebook' }).success).toBe(false);
  });

  it('rejects extras inside social even though the outer schema strips them', () => {
    expect(parse({ extra: 1 }).success).toBe(false);
  });
});
