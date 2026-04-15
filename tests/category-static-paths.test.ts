import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCollectionMock, renderMock } = vi.hoisted(() => ({
  getCollectionMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock('astro:content', () => ({
  getCollection: getCollectionMock,
  render: renderMock,
}));

vi.mock('astrowind:config', () => ({
  SITE: {
    base: '/',
  },
  APP_BLOG: {
    isEnabled: true,
    isRelatedPostsEnabled: true,
    postsPerPage: 10,
    list: { isEnabled: true, robots: {}, pathname: 'blog' },
    post: { isEnabled: true, robots: {} },
    category: { isEnabled: true, robots: {}, pathname: 'categorias' },
    tag: { isEnabled: true, robots: {}, pathname: 'temas' },
  },
}));

vi.mock('~/utils/utils', () => ({
  trim: (value: string, delimiter = '') => {
    if (!delimiter) {
      return value.trim();
    }

    const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const edgePattern = new RegExp(`^${escapedDelimiter}+|${escapedDelimiter}+$`, 'g');
    return value.replace(edgePattern, '');
  },
}));

function createPaginatedPage(data: unknown[], current: string) {
  return {
    data,
    start: data.length ? 0 : 0,
    end: data.length ? data.length - 1 : 0,
    total: data.length,
    currentPage: 1,
    size: 10,
    lastPage: 1,
    url: {
      current,
      prev: undefined,
      next: undefined,
      first: undefined,
      last: undefined,
    },
  };
}

describe('category static paths', () => {
  beforeEach(() => {
    vi.resetModules();
    getCollectionMock.mockReset();
    renderMock.mockReset();
    renderMock.mockResolvedValue({
      Content: () => null,
      remarkPluginFrontmatter: { readingTime: '1 min' },
    });
  });

  it('keeps the editorial category route when no editorial posts remain', async () => {
    getCollectionMock.mockResolvedValue([
      {
        id: 'science-1',
        slug: '2026-01-17-article-213',
        data: {
          date: new Date('2026-01-17T00:00:00Z'),
          title: 'Science post',
          excerpt: 'Excerpt',
          image: '~/assets/images/default.png',
          image_alt: 'Science hero',
          categories: ['Ciencia'],
          tags: [],
          author: 'Noticiencias',
        },
      },
    ]);

    const paginate = vi.fn(
      (
        data: unknown[],
        args?: { params?: { category?: string }; props?: { category?: unknown } }
      ) => [
        {
          params: { category: args?.params?.category, page: undefined },
          props: {
            category: args?.props?.category,
            page: createPaginatedPage(data, `/categorias/${args?.params?.category}/`),
          },
        },
      ]
    );

    const { getStaticPathsBlogCategory } = await import('../src/utils/blog');
    const paths = await getStaticPathsBlogCategory({ paginate } as never);

    expect(
      paths.some(
        (entry) =>
          entry.params.category === 'editorial' &&
          entry.params.page === undefined &&
          entry.props.page.total === 0 &&
          entry.props.page.url.current === '/categorias/editorial/'
      )
    ).toBe(true);
  });
});
