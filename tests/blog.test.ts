/**
 * Characterization tests for src/utils/blog.ts (plan 015 Step 1).
 * Pins resolvePostPermalink fallback + getNormalizedPost (via fetchPosts):
 * - permalink fallback without explicit permalink
 * - empty-slug / missing-title fail-closed aborts
 * - category/tag normalization
 * - duplicate-permalink abort on the generated-permalink path
 *   (the explicit-permalink slash-collision case already lives in
 *   tests/blog-permalink.test.ts — not duplicated here).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Top-level mocks (hoisted by Vitest) — mirrors tests/blog-permalink.test.ts.
vi.mock('astro:content', () => ({
  getCollection: vi.fn(async () => []),
  render: vi.fn(async () => ({ Content: () => null, remarkPluginFrontmatter: {} })),
}));

vi.mock('astrowind:config', () => ({
  SITE: {
    site: 'https://noticiencias.com',
    base: '/',
    trailingSlash: false,
  },
  I18N: { language: 'es', textDirection: 'ltr' },
  APP_BLOG: {
    isEnabled: true,
    postsPerPage: 6,
    list: { isEnabled: true, pathname: 'blog' },
    post: {
      isEnabled: true,
      permalink: '/%year%/%month%/%day%/%hour%/%minute%/%second%/%slug%',
    },
    category: { isEnabled: true, pathname: 'categorias' },
    tag: { isEnabled: true, pathname: 'temas' },
    isRelatedPostsEnabled: true,
  },
}));

vi.mock('~/utils/utils', () => ({
  trim: (str = '', ch?: string) => {
    if (!ch) return str.trim();
    let start = 0,
      end = str.length || 0;
    while (start < end && str[start] === ch) ++start;
    while (end > start && str[end - 1] === ch) --end;
    return start > 0 || end < str.length ? str.substring(start, end) : str;
  },
}));

type EntryData = {
  title?: string;
  date?: Date;
  permalink?: string;
  categories?: string[];
  tags?: string[];
};

const entry = (over: EntryData & { id?: string } = {}) => {
  const { id = '2026-01-31-mi-post.md', ...data } = over;
  return {
    id,
    data: {
      title: 'Mi post',
      date: new Date('2026-01-31T00:00:00Z'),
      ...data,
    },
  };
};

/** Fresh blog module per test so fetchPosts() cache does not leak across cases. */
async function loadBlog() {
  vi.resetModules();
  const blog = await import('../src/utils/blog');
  const content = await import('astro:content');
  return { ...blog, getCollectionMock: vi.mocked(content.getCollection) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePostPermalink fallback', () => {
  it('falls back to the generated pattern when no explicit permalink is set', async () => {
    const { resolvePostPermalink } = await loadBlog();
    const permalink = await resolvePostPermalink(entry() as never);
    expect(permalink).toBe('2026/01/31/00/00/00/2026-01-31-mi-post');
  });

  it('derives the category-aware fallback from the first raw category', async () => {
    // The default test pattern has no %category% slot, so the category only
    // affects explicit-permalink posts; this pins that the fallback does not
    // crash on categorized posts and still embeds the slug.
    const { resolvePostPermalink } = await loadBlog();
    const permalink = await resolvePostPermalink(
      entry({ id: 'salud-post.md', categories: ['Salud'] }) as never
    );
    expect(permalink).toContain('salud-post');
  });
});

describe('getNormalizedPost fail-closed guards (via fetchPosts)', () => {
  it('aborts the build when a post has no title', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([entry({ title: '' })] as never);
    await expect(fetchPosts()).rejects.toThrow(/CRITICAL: Post .* has no title/);
  });

  it('aborts the build when the slug cleans to empty', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([entry({ id: '---.md' })] as never);
    await expect(fetchPosts()).rejects.toThrow(/CRITICAL: Post .* resulted in empty slug/);
  });
});

describe('getNormalizedPost category/tag normalization (via fetchPosts)', () => {
  it('normalizes the first category to a slug/title taxonomy', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'post-a.md', categories: ['Salud Pública'] }),
    ] as never);
    const posts = await fetchPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].category).toEqual({ slug: 'salud-publica', title: 'Salud Pública' });
  });

  it('leaves category undefined when no categories are present', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([entry({ id: 'post-b.md' })] as never);
    const posts = await fetchPosts();
    expect(posts[0].category).toBeUndefined();
  });

  it('normalizes tags to lowercased slugs preserving display titles', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'post-c.md', tags: ['Inteligencia Artificial', 'Salud'] }),
    ] as never);
    const posts = await fetchPosts();
    expect(posts[0].tags).toEqual([
      { slug: 'inteligencia-artificial', title: 'Inteligencia Artificial' },
      { slug: 'salud', title: 'Salud' },
    ]);
  });

  it('returns an empty tag list when tags are absent', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([entry({ id: 'post-d.md' })] as never);
    const posts = await fetchPosts();
    expect(posts[0].tags).toEqual([]);
  });
});

describe('fetchPosts duplicate-permalink guard (generated path)', () => {
  it('aborts when two ids clean to the same slug on the same date', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    // "Mi Post.md" and "mi-post.md" both cleanSlug to "mi-post"; same date
    // means the generated timestamp+slug permalinks collide exactly.
    getCollectionMock.mockResolvedValue([
      entry({ id: 'Mi Post.md' }),
      entry({ id: 'mi-post.md' }),
    ] as never);
    await expect(fetchPosts()).rejects.toThrow(/CRITICAL: Duplicate permalink "/);
  });
});
