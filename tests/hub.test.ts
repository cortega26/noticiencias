import { describe, expect, it } from 'vitest';

import {
  buildCategoryRails,
  getRelatedTopics,
  getTopicFrequency,
  selectContextPosts,
  selectFeaturedPosts,
} from '../src/utils/hub';
import type { Post } from '../src/types';

function post(overrides: Partial<Post>): Post {
  return {
    id: overrides.id ?? 'post',
    slug: overrides.slug ?? 'post',
    permalink: overrides.permalink ?? 'ciencia/post',
    publishDate: overrides.publishDate ?? new Date('2026-01-01T00:00:00Z'),
    title: overrides.title ?? 'Post title',
    excerpt: overrides.excerpt ?? 'Excerpt',
    image: overrides.image,
    image_alt: overrides.image_alt,
    category: overrides.category,
    tags: overrides.tags ?? [],
    author: overrides.author,
    metadata: {},
    draft: false,
    ...overrides,
  };
}

describe('hub curation helpers', () => {
  it('selects featured posts by rank before falling back to date', () => {
    const posts = [
      post({ id: 'latest', publishDate: new Date('2026-03-01T00:00:00Z') }),
      post({
        id: 'featured-2',
        featured: true,
        featured_rank: 2,
        publishDate: new Date('2026-02-01T00:00:00Z'),
      }),
      post({
        id: 'featured-1',
        featured: true,
        featured_rank: 1,
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
    ];

    expect(selectFeaturedPosts(posts, 2).map((item) => item.id)).toEqual([
      'featured-1',
      'featured-2',
    ]);
  });

  it('falls back to latest posts when no featured posts exist', () => {
    const posts = [
      post({ id: 'older', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'newer', publishDate: new Date('2026-02-01T00:00:00Z') }),
    ];

    expect(selectFeaturedPosts(posts, 1).map((item) => item.id)).toEqual(['newer']);
  });

  it('selects context posts from why-it-matters or summary points', () => {
    const posts = [
      post({ id: 'plain' }),
      post({ id: 'summary', summary_points: ['Uno', 'Dos'] }),
      post({ id: 'why', why_it_matters: ['Importa'] }),
    ];

    expect(selectContextPosts(posts, 3).map((item) => item.id)).toEqual(['why', 'summary']);
  });

  it('computes topic frequency and related topics', () => {
    const posts = [
      post({
        id: 'a',
        tags: [
          { slug: 'ia', title: 'IA' },
          { slug: 'salud', title: 'Salud' },
        ],
      }),
      post({
        id: 'b',
        tags: [
          { slug: 'ia', title: 'IA' },
          { slug: 'energia', title: 'Energía' },
        ],
      }),
    ];

    expect(getTopicFrequency(posts, 2)).toEqual([
      { slug: 'ia', title: 'IA', count: 2 },
      { slug: 'energia', title: 'Energía', count: 1 },
    ]);
    expect(getRelatedTopics(posts, 'ia', 2).map((topic) => topic.slug)).toEqual([
      'energia',
      'salud',
    ]);
  });

  it('returns an empty topic list when recent posts have no tags', () => {
    expect(getTopicFrequency([post({ id: 'untagged', tags: [] })], 5)).toEqual([]);
  });

  it('builds category rails from matching posts', () => {
    const posts = [
      post({ id: 'ciencia', category: { slug: 'ciencia', title: 'Ciencia' } }),
      post({ id: 'salud', category: { slug: 'salud', title: 'Salud' } }),
    ];

    const rails = buildCategoryRails(posts, [{ slug: 'ciencia', title: 'Ciencia' }], 3);

    expect(rails).toHaveLength(1);
    expect(rails[0].posts.map((item) => item.id)).toEqual(['ciencia']);
  });
});
