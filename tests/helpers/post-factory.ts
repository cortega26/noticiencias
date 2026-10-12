import type { Post } from '../../src/types';

const base: Post = {
  id: 'post',
  slug: 'post',
  permalink: 'ciencia/post',
  publishDate: new Date('2026-01-01T00:00:00Z'),
  title: 'Post title',
  excerpt: 'Excerpt',
  tags: [],
  metadata: {},
  draft: false,
  displayAuthor: 'Noticiencias',
  isNoticienciasAi: false,
  institutionalAuthor: true,
  sourcePublisher: null,
  sourceFallback: undefined,
  evidenceChips: [],
};

/** Minimal Post fixture: defaults + explicit overrides. */
export function makePost(overrides: Partial<Post> = {}): Post {
  return { ...base, ...overrides };
}
