/**
 * Regression tests for blog permalink generation (plan 011).
 * - generatePermalink must use UTC getters so midnight-UTC posts keep
 *   their publication day regardless of the build host's timezone.
 * - Explicit frontmatter permalinks must be slash-normalized so
 *   `/salud/x` and `salud/x/` collide in the fail-closed duplicate guard.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// Top-level mocks (hoisted by Vitest)
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

import { getCollection } from 'astro:content';
import { resolvePostPermalink, fetchPosts } from '../src/utils/blog';

type Entry = {
  id: string;
  data: {
    title: string;
    date: Date;
    permalink?: string;
  };
};

const entry = (over: Partial<Entry['data']> & { id?: string } = {}): Entry => {
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

const ORIG_TZ = process.env.TZ;
afterEach(() => {
  if (ORIG_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIG_TZ;
});

describe('generatePermalink uses UTC', () => {
  it.each(['Pacific/Kiritimati', 'America/New_York'])(
    'dates a midnight-UTC post on 2026/01/31 under %s',
    async (tz) => {
      process.env.TZ = tz;
      const permalink = await resolvePostPermalink(entry() as never);
      expect(permalink).toBe('2026/01/31/00/00/00/2026-01-31-mi-post');
    }
  );
});

describe('explicit permalinks are slash-normalized', () => {
  it.each(['/salud/mi-post', 'salud/mi-post/'])('normalizes %s to salud/mi-post', async (raw) => {
    const permalink = await resolvePostPermalink(entry({ permalink: raw }) as never);
    expect(permalink).toBe('salud/mi-post');
  });

  it('aborts the build when two posts differ only by leading/trailing slash', async () => {
    vi.mocked(getCollection).mockResolvedValue([
      entry({ id: 'a.md', permalink: '/salud/x' }),
      entry({ id: 'b.md', permalink: 'salud/x/' }),
    ] as never);
    await expect(fetchPosts()).rejects.toThrow(/CRITICAL: Duplicate permalink "salud\/x"/);
  });
});
