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
  sources?: {
    title: string;
    url: string;
    role?: 'primary' | 'secondary';
  }[];
  evidence_subject_type?:
    | 'humans'
    | 'animals'
    | 'in_vitro'
    | 'computational'
    | 'observational'
    | 'experimental'
    | 'mixed'
    | 'unknown';
  publication_status?: 'peer_reviewed' | 'preprint' | 'conference' | 'other';
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

describe('findPostsBySlugs', () => {
  it('keeps only the slugs that resolve and skips the misses', async () => {
    const { findPostsBySlugs, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: '2026-01-31-mi-post.md' }),
      entry({ id: '2026-02-01-otro-post.md', date: new Date('2026-02-01T00:00:00Z') }),
    ] as never);

    const found = await findPostsBySlugs(['2026-01-31-mi-post', 'no-existe']);

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('2026-01-31-mi-post.md');
    expect(found[0].slug).toBe('2026-01-31-mi-post');
  });

  it('returns an empty list for a non-array argument', async () => {
    const { findPostsBySlugs } = await loadBlog();
    await expect(findPostsBySlugs(undefined as never)).resolves.toEqual([]);
  });
});

describe('findPostsByIds', () => {
  it('keeps only the ids that resolve and skips the misses', async () => {
    const { findPostsByIds, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: '2026-01-31-mi-post.md' }),
      entry({ id: '2026-02-01-otro-post.md', date: new Date('2026-02-01T00:00:00Z') }),
    ] as never);

    const found = await findPostsByIds(['2026-01-31-mi-post.md', 'missing.md']);

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('2026-01-31-mi-post.md');
  });

  it('returns an empty list for a non-array argument', async () => {
    const { findPostsByIds } = await loadBlog();
    await expect(findPostsByIds(null as never)).resolves.toEqual([]);
  });
});

describe('findLatestPosts', () => {
  it('slices the newest posts down to the requested count', async () => {
    const { findLatestPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'viejo.md', date: new Date('2026-01-01T00:00:00Z') }),
      entry({ id: 'nuevo.md', date: new Date('2026-02-01T00:00:00Z') }),
      entry({ id: 'mas-nuevo.md', date: new Date('2026-03-01T00:00:00Z') }),
    ] as never);

    const latest = await findLatestPosts({ count: 2 });

    expect(latest).toHaveLength(2);
    expect(latest.map((post) => post.id)).toEqual(['mas-nuevo.md', 'nuevo.md']);
  });
});

describe('evidence chips (via fetchPosts)', () => {
  it('emits the primary-source chip when a source declares role primary', async () => {
    const { fetchPosts, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({
        id: 'evidencia.md',
        sources: [
          { title: 'Artículo', url: 'https://example.com/a', role: 'primary' },
          { title: 'Cobertura', url: 'https://example.com/b', role: 'secondary' },
        ],
        evidence_subject_type: 'humans',
        publication_status: 'peer_reviewed',
      }),
    ] as never);

    const posts = await fetchPosts();

    expect(posts[0].evidenceChips).toEqual([
      'Modelo: personas',
      'Revisión por pares',
      'Fuente primaria',
    ]);
    expect(posts[0].sourceFallback).toEqual([
      { title: 'Artículo', url: 'https://example.com/a', role: 'primary' },
      { title: 'Cobertura', url: 'https://example.com/b', role: 'secondary' },
    ]);
  });
});

describe('getStaticPathsBlogList', () => {
  it('passes every post to paginate and returns the pages it produces', async () => {
    const { getStaticPathsBlogList, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'lista-a.md' }),
      entry({ id: 'lista-b.md', date: new Date('2026-02-01T00:00:00Z') }),
    ] as never);

    const paginate = vi.fn(
      (posts: unknown[], opts: { params: { blog?: string }; pageSize?: number }) => [
        { params: { blog: opts.params.blog, pageCount: posts.length } },
      ]
    );

    const paths = await getStaticPathsBlogList({ paginate } as never);

    expect(paginate).toHaveBeenCalledTimes(1);
    const [postsArg, optsArg] = paginate.mock.calls[0];
    expect(postsArg.map((post: { id: string }) => post.id)).toEqual(['lista-b.md', 'lista-a.md']);
    expect(optsArg).toEqual({ params: { blog: 'blog' }, pageSize: 6 });
    expect(paths).toEqual([{ params: { blog: 'blog', pageCount: 2 } }]);
  });
});

describe('getStaticPathsBlogPost', () => {
  it('maps each post permalink to a path whose props carry the post', async () => {
    const { fetchPosts, getStaticPathsBlogPost, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'post-uno.md' }),
      entry({ id: 'post-dos.md', date: new Date('2026-02-01T00:00:00Z') }),
    ] as never);

    const posts = await fetchPosts();
    const paths = await getStaticPathsBlogPost();

    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.params.blog)).toEqual(posts.map((post) => post.permalink));
    expect(paths.map((path) => path.props.post)).toEqual(posts);
  });
});

describe('getStaticPathsBlogCategory', () => {
  it('paginates the categories that have posts', async () => {
    const { getStaticPathsBlogCategory, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'cat-ciencia.md', categories: ['Ciencia'] }),
    ] as never);

    const paginate = vi.fn(
      (
        posts: unknown[],
        opts: { params: { category?: string }; props?: { category?: unknown } }
      ) => [{ params: { category: opts.params.category, page: posts.length } }]
    );

    const paths = await getStaticPathsBlogCategory({ paginate } as never);

    expect(paginate).toHaveBeenCalledTimes(1);
    const [postsArg, optsArg] = paginate.mock.calls[0];
    expect(postsArg.map((post: { id: string }) => post.id)).toEqual(['cat-ciencia.md']);
    expect(optsArg.params).toEqual({ category: 'ciencia' });
    expect(optsArg.props).toEqual({ category: { slug: 'ciencia', title: 'Ciencia' } });
    expect(paths).toContainEqual({ params: { category: 'ciencia', page: 1 } });
  });
});

describe('getStaticPathsBlogTag', () => {
  it('paginates every tag with its posts and related topics', async () => {
    const { getStaticPathsBlogTag, getCollectionMock } = await loadBlog();
    getCollectionMock.mockResolvedValue([
      entry({ id: 'tag-uno.md', tags: ['Salud', 'Inteligencia Artificial'] }),
      entry({
        id: 'tag-dos.md',
        date: new Date('2026-02-01T00:00:00Z'),
        tags: ['Salud'],
      }),
    ] as never);

    const paginate = vi.fn(
      (
        posts: unknown[],
        opts: { params: Record<string, unknown>; props?: Record<string, unknown> }
      ) => [{ params: { ...opts.params, captured: posts.length } }]
    );

    const paths = await getStaticPathsBlogTag({ paginate } as never);

    expect(paginate).toHaveBeenCalledTimes(2);
    expect(paginate.mock.calls.map(([, opts]) => opts.params)).toEqual([
      { tag: 'salud', blog: 'temas' },
      { tag: 'inteligencia-artificial', blog: 'temas' },
    ]);
    expect(paginate.mock.calls.map(([posts]) => posts.length)).toEqual([2, 1]);

    const [saludPosts, saludOpts] = paginate.mock.calls[0];
    expect(saludPosts.map((post: { id: string }) => post.id)).toEqual(['tag-dos.md', 'tag-uno.md']);
    expect(saludOpts.props).toMatchObject({
      tag: { slug: 'salud', title: 'Salud' },
      tagPosts: saludPosts,
      relatedTopics: [],
    });

    expect(paths).toEqual([
      { params: { tag: 'salud', blog: 'temas', captured: 2 } },
      { params: { tag: 'inteligencia-artificial', blog: 'temas', captured: 1 } },
    ]);
  });
});
