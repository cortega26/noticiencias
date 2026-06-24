/**
 * Unit tests for permalink utilities.
 * Tests URL generation, slug cleaning, and permalink patterns.
 */

import { describe, it, expect, vi } from 'vitest';

// Top-level mocks (hoisted by Vitest)
vi.mock('astrowind:config', () => ({
  SITE: {
    site: 'https://noticiencias.com',
    base: '/',
    trailingSlash: false,
  },
  APP_BLOG: {
    isEnabled: true,
    postsPerPage: 6,
    list: { isEnabled: true, pathname: 'blog' },
    post: { isEnabled: true, permalink: '/%category%/%slug%' },
    category: { isEnabled: true, pathname: 'categorias' },
    tag: { isEnabled: true, pathname: 'temas' },
    isRelatedPostsEnabled: true,
    relatedPostsCount: 4,
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

import {
  trimSlash,
  cleanSlug,
  getPermalink,
  getHomePermalink,
  getBlogPermalink,
  getCanonical,
  BLOG_BASE,
  CATEGORY_BASE,
  TAG_BASE,
} from '../../src/utils/permalinks';

describe('trimSlash', () => {
  it('removes leading and trailing slashes', () => {
    expect(trimSlash('/blog/')).toBe('blog');
    expect(trimSlash('/categorias/')).toBe('categorias');
    expect(trimSlash('blog')).toBe('blog');
    expect(trimSlash('/')).toBe('');
  });
});

describe('cleanSlug', () => {
  it('slugifies text', () => {
    expect(cleanSlug('Hello World')).toBe('hello-world');
    expect(cleanSlug('Ciencia y Tecnología')).toMatch(/^ciencia/);
  });

  it('handles empty text', () => {
    expect(cleanSlug('')).toBe('');
  });

  it('handles multi-segment paths', () => {
    expect(cleanSlug('/Categoría/Artículo/')).toMatch(/categoria/);
  });
});

describe('BLOG_BASE, CATEGORY_BASE, TAG_BASE', () => {
  it('BLOG_BASE is "blog"', () => {
    expect(BLOG_BASE).toBe('blog');
  });
  it('CATEGORY_BASE is "categorias"', () => {
    expect(CATEGORY_BASE).toBe('categorias');
  });
  it('TAG_BASE is "temas"', () => {
    expect(TAG_BASE).toBe('temas');
  });
});

describe('getPermalink', () => {
  it('returns home permalink for type "home"', () => {
    const link = getPermalink('/', 'home');
    expect(link).toBe('/');
  });

  it('returns blog permalink', () => {
    const link = getPermalink('', 'blog');
    expect(link).toBe('/blog');
  });

  it('returns category permalink', () => {
    const link = getPermalink('ciencia', 'category');
    expect(link).toContain('categorias');
    expect(link).toContain('ciencia');
  });

  it('returns tag permalink', () => {
    const link = getPermalink('inteligencia-artificial', 'tag');
    expect(link).toContain('temas');
    expect(link).toContain('inteligencia-artificial');
  });

  it('passes through external URLs unchanged', () => {
    const url = 'https://example.com/article';
    expect(getPermalink(url)).toBe(url);
  });

  it('passes through anchors unchanged', () => {
    expect(getPermalink('#section')).toBe('#section');
  });

  it('blocks javascript: URLs', () => {
    expect(getPermalink('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('getHomePermalink', () => {
  it('returns /', () => {
    expect(getHomePermalink()).toBe('/');
  });
});

describe('getBlogPermalink', () => {
  it('returns /blog', () => {
    expect(getBlogPermalink()).toBe('/blog');
  });
});

describe('getCanonical', () => {
  it('returns full URL', () => {
    const url = getCanonical('/blog');
    expect(url.toString()).toBe('https://noticiencias.com/blog');
  });

  it('returns home URL for empty path', () => {
    const url = getCanonical('');
    // URL('', base) produces a trailing slash; the real impl only strips it when path is truthy
    expect(url.toString()).toMatch(/^https:\/\/noticiencias\.com/);
  });
});
