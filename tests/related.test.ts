import { describe, expect, it } from 'vitest';

import { rankRelatedPosts } from '../src/utils/related';
import { makePost as post } from './helpers/post-factory';

const ORIGINAL = post({
  id: 'original',
  category: { slug: 'ciencia', title: 'Ciencia' },
  tags: [{ slug: 'coral', title: 'coral' }],
  series: 'Espacio',
});

describe('rankRelatedPosts (P2-01)', () => {
  it('qualifies and ranks same-category candidates above shared-tag ones', () => {
    const allPosts = [
      ORIGINAL,
      post({
        id: 'same-category',
        category: { slug: 'ciencia', title: 'Ciencia' },
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
      post({
        id: 'shared-tag',
        category: { slug: 'biologia', title: 'Biología' },
        tags: [{ slug: 'coral', title: 'coral' }],
        publishDate: new Date('2026-06-01T00:00:00Z'),
      }),
      post({
        id: 'unrelated-newest',
        category: { slug: 'tecnologia', title: 'Tecnología' },
        publishDate: new Date('2026-09-01T00:00:00Z'),
      }),
    ];

    const selection = rankRelatedPosts(ORIGINAL, allPosts);

    expect(selection.kind).toBe('related');
    expect(selection.posts.map((item) => item.id)).toEqual(['same-category', 'shared-tag']);
  });

  it('qualifies a shared tag on its own', () => {
    const allPosts = [
      ORIGINAL,
      post({
        id: 'tag-peer',
        category: { slug: 'salud', title: 'Salud' },
        tags: [{ slug: 'coral', title: 'coral' }],
      }),
    ];

    expect(rankRelatedPosts(ORIGINAL, allPosts)).toMatchObject({
      kind: 'related',
      posts: [{ id: 'tag-peer' }],
    });
  });

  it('qualifies a same-series candidate', () => {
    const allPosts = [ORIGINAL, post({ id: 'series-peer', series: 'Espacio' })];

    expect(rankRelatedPosts(ORIGINAL, allPosts).kind).toBe('related');
  });

  it('does not qualify methodology-only similarity and falls back to recent', () => {
    const allPosts = [
      ORIGINAL,
      post({
        id: 'same-method',
        category: { slug: 'salud', title: 'Salud' },
        evidence_subject_type: ORIGINAL.evidence_subject_type ?? 'humans',
        publication_status: ORIGINAL.publication_status ?? 'peer_reviewed',
        publishDate: new Date('2026-03-01T00:00:00Z'),
      }),
      post({
        id: 'newer-unrelated',
        category: { slug: 'tecnologia', title: 'Tecnología' },
        publishDate: new Date('2026-08-01T00:00:00Z'),
      }),
    ];

    const selection = rankRelatedPosts(ORIGINAL, allPosts);

    expect(selection.kind).toBe('recent');
    expect(selection.posts.map((item) => item.id)).toEqual(['newer-unrelated', 'same-method']);
  });

  it('falls back to newest posts, excluding the original, when nothing qualifies', () => {
    const allPosts = [
      ORIGINAL,
      post({ id: 'old', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'new', publishDate: new Date('2026-05-01T00:00:00Z') }),
    ];

    const selection = rankRelatedPosts(ORIGINAL, allPosts, 1);

    expect(selection).toEqual({
      kind: 'recent',
      posts: [expect.objectContaining({ id: 'new' })],
    });
  });

  it('breaks score ties by newest publish date and caps the result', () => {
    const allPosts = [
      ORIGINAL,
      post({
        id: 'cat-older',
        category: { slug: 'ciencia', title: 'Ciencia' },
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
      post({
        id: 'cat-newer',
        category: { slug: 'ciencia', title: 'Ciencia' },
        publishDate: new Date('2026-07-01T00:00:00Z'),
      }),
      post({
        id: 'cat-middle',
        category: { slug: 'ciencia', title: 'Ciencia' },
        publishDate: new Date('2026-04-01T00:00:00Z'),
      }),
    ];

    const selection = rankRelatedPosts(ORIGINAL, allPosts, 2);

    expect(selection.posts.map((item) => item.id)).toEqual(['cat-newer', 'cat-middle']);
  });
});
