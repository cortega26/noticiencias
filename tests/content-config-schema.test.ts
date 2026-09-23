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
      // P0-06 / DEC-003: why_it_matters has no minimum, so its absence
      // must NOT appear here.
      expect(paths).toEqual(
        expect.arrayContaining([
          'summary_points',
          'glossary',
          'fact_check',
          'confidence',
          'sources',
        ])
      );
      expect(paths).not.toContain('why_it_matters');
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

    describe('primary source fields (P0-01)', () => {
      const sourceBase = { title: 'Source', url: 'https://example.com' };

      it('accepts legacy sources without role or doi', () => {
        const result = schema.safeParse({ ...basePost, sources: [sourceBase] });
        expect(result.success).toBe(true);
      });

      it('accepts a primary source with DOI', () => {
        const result = schema.safeParse({
          ...basePost,
          sources: [
            { ...sourceBase, role: 'primary', doi: '10.1371/journal.pone.0353485' },
            { ...sourceBase, role: 'secondary' },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('rejects a malformed DOI', () => {
        const result = schema.safeParse({
          ...basePost,
          sources: [{ ...sourceBase, role: 'primary', doi: 'not-a-doi' }],
        });
        expect(result.success).toBe(false);
      });

      it('rejects an unknown source role', () => {
        const result = schema.safeParse({
          ...basePost,
          sources: [{ ...sourceBase, role: 'tertiary' }],
        });
        expect(result.success).toBe(false);
      });

      it('rejects a DOI without primary role', () => {
        const result = schema.safeParse({
          ...basePost,
          sources: [{ ...sourceBase, doi: '10.1371/journal.pone.0353485' }],
        });
        expect(result.success).toBe(false);
      });
    });

    describe('evidence subject type (P0-02)', () => {
      it.each([
        ['humans'],
        ['animals'],
        ['in_vitro'],
        ['computational'],
        ['observational'],
        ['experimental'],
        ['mixed'],
        ['unknown'],
      ])('accepts %p', (evidence_subject_type) => {
        const result = schema.safeParse({ ...basePost, evidence_subject_type });
        expect(result.success).toBe(true);
      });

      it('rejects an unknown evidence value (no silent inference)', () => {
        const result = schema.safeParse({
          ...basePost,
          evidence_subject_type: 'clinical-trial',
        });
        expect(result.success).toBe(false);
      });

      it('accepts an optional detail string and rejects an empty one', () => {
        expect(
          schema.safeParse({ ...basePost, evidence_detail: 'Ratones NOD SCID.' }).success
        ).toBe(true);
        expect(schema.safeParse({ ...basePost, evidence_detail: '' }).success).toBe(false);
      });
    });

    describe('Wave 3 accountability fields (P0-03/P0-09/P2-02/P2-07)', () => {
      it.each([['peer_reviewed'], ['preprint'], ['conference'], ['other']])(
        'accepts publication_status %p',
        (publication_status) => {
          expect(schema.safeParse({ ...basePost, publication_status }).success).toBe(true);
        }
      );

      it('rejects an unknown publication_status', () => {
        expect(schema.safeParse({ ...basePost, publication_status: 'rumor' }).success).toBe(false);
      });

      it('accepts a full reviewer block and a reviewer-less post', () => {
        expect(
          schema.safeParse({
            ...basePost,
            reviewer_name: 'Ada Lovelace',
            reviewer_role: 'Editora',
            reviewer_profile_url: 'https://example.com/ada',
            review_date: '2026-09-01',
          }).success
        ).toBe(true);
        expect(schema.safeParse(basePost).success).toBe(true);
      });

      it.each([[['a']], [['a', 'b']], [['a', 'b', 'c']]])(
        'accepts known_points/open_questions with %p',
        (items) => {
          expect(
            schema.safeParse({ ...basePost, known_points: items, open_questions: items }).success
          ).toBe(true);
        }
      );

      it('rejects a fourth known_point', () => {
        expect(schema.safeParse({ ...basePost, known_points: ['a', 'b', 'c', 'd'] }).success).toBe(
          false
        );
      });

      it('accepts a complete correction and rejects half-corrections', () => {
        expect(
          schema.safeParse({
            ...basePost,
            corrected_at: '2026-09-02',
            correction_summary: 'Se corrigió una cifra.',
          }).success
        ).toBe(true);
        expect(schema.safeParse({ ...basePost, corrected_at: '2026-09-02' }).success).toBe(false);
        expect(
          schema.safeParse({ ...basePost, correction_summary: 'Se corrigió una cifra.' }).success
        ).toBe(false);
      });

      it('rejects malformed correction/review dates', () => {
        expect(schema.safeParse({ ...basePost, review_date: '02/09/2026' }).success).toBe(false);
      });
    });

    describe('why_it_matters cardinalities (P0-06 / DEC-003)', () => {
      const validV2Base = {
        ...basePost,
        schema_version: 2,
        summary_points: ['Point one', 'Point two'],
        glossary: [{ term: 'Term', definition: 'Definition' }],
        fact_check: [{ label: 'Claim', status: 'verified' }],
        confidence: 'high',
        sources: [{ title: 'Source', url: 'https://example.com' }],
      };

      it.each([[undefined], [[]], [['One']], [['One', 'Two']], [['One', 'Two', 'Three']]])(
        'accepts %p items',
        (why_it_matters) => {
          const result = schema.safeParse({ ...validV2Base, why_it_matters });
          expect(result.success).toBe(true);
        }
      );

      it('rejects more than 3 items', () => {
        const result = schema.safeParse({
          ...validV2Base,
          why_it_matters: ['One', 'Two', 'Three', 'Four'],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.some((i) => i.path.includes('why_it_matters'))).toBe(true);
      });

      it('rejects empty-string items', () => {
        const result = schema.safeParse({ ...validV2Base, why_it_matters: [''] });
        expect(result.success).toBe(false);
      });
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

    it('rejects a malformed social.id (non-hex / uppercase / wrong length)', () => {
      for (const id of ['NOT-HEX', 'abc', 'A'.repeat(64), `${hexId}a`, hexId.slice(0, -1)]) {
        expect(schema.safeParse({ ...basePost, social: { publish: false, id } }).success).toBe(
          false
        );
      }
    });

    it('rejects an id with surrounding whitespace or a trailing newline', () => {
      // Parity guard: Python `re` lets `$` match before a trailing newline, so a
      // mirror built with re.search would accept these. The Zod regex must not.
      for (const id of [`${hexId}\n`, `\n${hexId}`, `${hexId} `, ` ${hexId}`]) {
        expect(schema.safeParse({ ...basePost, social: { publish: true, id } }).success).toBe(
          false
        );
      }
    });

    it('rejects a non-boolean social.publish (no "true" / 1 / 0 coercion)', () => {
      for (const publish of ['true', 1, 0]) {
        expect(schema.safeParse({ ...basePost, social: { publish } }).success).toBe(false);
      }
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
