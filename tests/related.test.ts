import { describe, expect, it } from 'vitest';

import { rankAllRelatedPosts, rankRelatedPosts } from '../src/utils/related';
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

describe('rankAllRelatedPosts (batch precompute used by the build)', () => {
  const original = post({
    id: 'batch-original',
    category: { slug: 'ciencia', title: 'Ciencia' },
    tags: [{ slug: 'coral', title: 'coral' }],
  });
  const peers = [
    post({
      id: 'peer-1',
      category: { slug: 'ciencia', title: 'Ciencia' },
      publishDate: new Date('2026-01-01T00:00:00Z'),
    }),
    post({
      id: 'peer-2',
      category: { slug: 'ciencia', title: 'Ciencia' },
      publishDate: new Date('2026-02-01T00:00:00Z'),
    }),
    post({
      id: 'peer-3',
      category: { slug: 'ciencia', title: 'Ciencia' },
      publishDate: new Date('2026-03-01T00:00:00Z'),
    }),
    post({
      id: 'peer-4',
      category: { slug: 'ciencia', title: 'Ciencia' },
      publishDate: new Date('2026-04-01T00:00:00Z'),
    }),
    post({
      id: 'peer-5',
      category: { slug: 'ciencia', title: 'Ciencia' },
      publishDate: new Date('2026-05-01T00:00:00Z'),
    }),
  ];
  const allPosts = [original, ...peers];
  const newestFirst = ['peer-5', 'peer-4', 'peer-3', 'peer-2'];

  it('matches the single-post ranking for every post', () => {
    const batch = rankAllRelatedPosts(allPosts, 4);

    for (const candidate of allPosts) {
      expect(batch.get(candidate.id)).toEqual(rankRelatedPosts(candidate, allPosts, 4));
    }
  });

  it('is deterministic across calls with the same post array', () => {
    const first = rankAllRelatedPosts(allPosts, 4);
    const second = rankAllRelatedPosts(allPosts, 4);

    for (const candidate of allPosts) {
      expect(second.get(candidate.id)).toEqual(first.get(candidate.id));
    }
  });

  it('preserves the newest-first tie order and the top-four cap', () => {
    const selection = rankAllRelatedPosts(allPosts, 4).get(original.id);

    expect(selection?.kind).toBe('related');
    expect(selection?.posts.map((item) => item.id)).toEqual(newestFirst);
  });

  it('keeps a smaller cap from poisoning the cache for a larger one', () => {
    const smaller = rankAllRelatedPosts(allPosts, 2);
    const larger = rankAllRelatedPosts(allPosts, 4);

    expect(smaller.get(original.id)?.posts.map((item) => item.id)).toEqual(['peer-5', 'peer-4']);
    expect(larger.get(original.id)?.posts.map((item) => item.id)).toEqual(newestFirst);
  });
});
