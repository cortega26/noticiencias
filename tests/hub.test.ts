import { describe, expect, it } from 'vitest';

import {
  getEditionDate,
  getRelatedTopics,
  getTopicFrequency,
  selectArchivePosts,
  selectFeaturedPosts,
  selectRecentPosts,
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

  it('prefers investigation posts as tiebreaker when featured ranks match', () => {
    const posts = [
      post({
        id: 'featured-no-investigation',
        featured: true,
        featured_rank: 1,
        investigation: false,
        publishDate: new Date('2026-02-01T00:00:00Z'),
      }),
      post({
        id: 'featured-investigation',
        featured: true,
        featured_rank: 1,
        investigation: true,
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
    ];

    expect(selectFeaturedPosts(posts, 2).map((item) => item.id)).toEqual([
      'featured-investigation',
      'featured-no-investigation',
    ]);
  });

  it('prefers investigation posts in fallback when no featured posts are set', () => {
    const posts = [
      post({
        id: 'plain-newer',
        investigation: false,
        publishDate: new Date('2026-03-01T00:00:00Z'),
      }),
      post({
        id: 'investigation-older',
        investigation: true,
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
    ];

    expect(selectFeaturedPosts(posts, 1).map((item) => item.id)).toEqual(['investigation-older']);
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
      post({
        id: 'c',
        tags: [
          { slug: 'ia', title: 'IA' },
          { slug: 'energia', title: 'Energía' },
        ],
      }),
      post({
        id: 'd',
        tags: [
          { slug: 'ia', title: 'IA' },
          { slug: 'salud', title: 'Salud' },
        ],
      }),
    ];

    expect(getTopicFrequency(posts, 2)).toEqual([
      { slug: 'ia', title: 'IA', count: 4 },
      { slug: 'energia', title: 'Energía', count: 2 },
    ]);
    expect(getRelatedTopics(posts, 'ia', 2).map((topic) => topic.slug)).toEqual([
      'energia',
      'salud',
    ]);
  });

  it('returns an empty topic list when recent posts have no tags', () => {
    expect(getTopicFrequency([post({ id: 'untagged', tags: [] })], 5)).toEqual([]);
  });

  it('falls back to the current time when the edition has no posts', () => {
    const before = Date.now();
    const date = getEditionDate([]);
    expect(date.valueOf()).toBeGreaterThanOrEqual(before);
  });

  it('returns the latest publish date across posts', () => {
    const posts = [
      post({ id: 'old', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'new', publishDate: new Date('2026-05-01T00:00:00Z') }),
    ];
    expect(getEditionDate(posts).valueOf()).toBe(new Date('2026-05-01T00:00:00Z').valueOf());
  });

  it('breaks featured ties by newest publish date when investigation matches', () => {
    const posts = [
      post({
        id: 'older-featured',
        featured: true,
        featured_rank: 1,
        investigation: true,
        publishDate: new Date('2026-01-01T00:00:00Z'),
      }),
      post({
        id: 'newer-featured',
        featured: true,
        featured_rank: 1,
        investigation: true,
        publishDate: new Date('2026-02-01T00:00:00Z'),
      }),
    ];

    expect(selectFeaturedPosts(posts, 2).map((item) => item.id)).toEqual([
      'newer-featured',
      'older-featured',
    ]);
  });
});

describe('home recency helpers', () => {
  it('selects only stories inside the edition window, newest first', () => {
    const posts = [
      post({ id: 'edition', publishDate: new Date('2026-09-20T00:00:00Z') }),
      post({ id: 'inside', publishDate: new Date('2026-09-18T00:00:00Z') }),
      post({ id: 'edge', publishDate: new Date('2026-09-13T00:00:00Z') }),
      post({ id: 'outside', publishDate: new Date('2026-09-12T00:00:00Z') }),
    ];

    const selection = selectRecentPosts(posts, new Date('2026-09-20T00:00:00Z'));

    expect(selection.inWindow).toBe(true);
    expect(selection.posts.map((item) => item.id)).toEqual(['edition', 'inside', 'edge']);
  });

  it('honors excludeIds and the count cap inside the window', () => {
    const posts = [
      post({ id: 'hero', publishDate: new Date('2026-09-20T00:00:00Z') }),
      post({ id: 'second', publishDate: new Date('2026-09-19T00:00:00Z') }),
      post({ id: 'third', publishDate: new Date('2026-09-18T00:00:00Z') }),
    ];

    const selection = selectRecentPosts(posts, new Date('2026-09-20T00:00:00Z'), {
      count: 1,
      excludeIds: ['hero'],
    });

    expect(selection.inWindow).toBe(true);
    expect(selection.posts.map((item) => item.id)).toEqual(['second']);
  });

  it('falls back to newest stories and reports the fallback when the window is empty', () => {
    const posts = [
      post({ id: 'old', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'older', publishDate: new Date('2025-12-01T00:00:00Z') }),
    ];

    const selection = selectRecentPosts(posts, new Date('2026-09-20T00:00:00Z'), {
      excludeIds: ['old'],
    });

    expect(selection.inWindow).toBe(false);
    expect(selection.posts.map((item) => item.id)).toEqual(['older']);
  });

  it('selects archive posts excluding what is already promoted', () => {
    const posts = [
      post({ id: 'hero', publishDate: new Date('2026-09-20T00:00:00Z') }),
      post({ id: 'week', publishDate: new Date('2026-09-19T00:00:00Z') }),
      post({ id: 'archive-1', publishDate: new Date('2026-08-28T00:00:00Z') }),
      post({ id: 'archive-2', publishDate: new Date('2026-08-27T00:00:00Z') }),
      post({ id: 'archive-3', publishDate: new Date('2026-08-26T00:00:00Z') }),
      post({ id: 'archive-4', publishDate: new Date('2026-08-25T00:00:00Z') }),
    ];

    const archive = selectArchivePosts(posts, { count: 3, excludeIds: ['hero', 'week'] });

    expect(archive.map((item) => item.id)).toEqual(['archive-1', 'archive-2', 'archive-3']);
  });
});
