import slugify from 'limax';

import { SITE, APP_BLOG } from 'astrowind:config';

import { trim } from '~/utils/utils';

export const trimSlash = (s: string) => trim(trim(s, '/'));
const createPath = (...params: string[]) => {
  const paths = params
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
  return '/' + paths + (SITE.trailingSlash && paths ? '/' : '');
};

const BASE_PATHNAME = SITE.base || '/';

export const cleanSlug = (text = '') =>
  trimSlash(text)
    .split('/')
    .map((slug) => slugify(slug))
    .join('/')
    .toLowerCase();

export const BLOG_BASE = cleanSlug(APP_BLOG?.list?.pathname ?? 'blog');
export const CATEGORY_BASE = cleanSlug(APP_BLOG?.category?.pathname ?? 'category');
export const TAG_BASE = cleanSlug(APP_BLOG?.tag?.pathname ?? 'tag');

export const POST_PERMALINK_PATTERN = trimSlash(APP_BLOG?.post?.permalink || `${BLOG_BASE}/%slug%`);

/** */
export const getCanonical = (path = ''): string | URL => {
  const url = String(new URL(path, SITE.site));
  if (SITE.trailingSlash == false && path && url.endsWith('/')) {
    return url.slice(0, -1);
  } else if (SITE.trailingSlash == true && path && !url.endsWith('/')) {
    return url + '/';
  }
  return url;
};

/** */
const PERMALINK_TYPES: Record<string, (slug: string) => string> = {
  home: () => getHomePermalink(),
  blog: () => getBlogPermalink(),
  asset: (slug: string) => getAsset(slug),
  category: (slug: string) => createPath(CATEGORY_BASE, trimSlash(slug)),
  tag: (slug: string) => createPath(TAG_BASE, trimSlash(slug)),
  post: (slug: string) => createPath(trimSlash(slug)),
  page: (slug: string) => createPath(slug),
};

export const getPermalink = (slug = '', type = 'page'): string => {
  if (
    slug.startsWith('https://') ||
    slug.startsWith('http://') ||
    slug.startsWith('://') ||
    slug.startsWith('#') ||
    slug.startsWith('javascript:') ||
    slug.startsWith('data:') ||
    slug.startsWith('vbscript:')
  ) {
    return slug;
  }

  const permalinkFn = PERMALINK_TYPES[type] || PERMALINK_TYPES['page'];
  return definitivePermalink(permalinkFn(slug));
};

/** */
export const getHomePermalink = (): string => getPermalink('/');

/** */
export const getBlogPermalink = (): string => getPermalink(BLOG_BASE);

/** */
export const getAsset = (path: string): string =>
  '/' +
  [import.meta.env.BASE_URL, path]
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');

/** */
const definitivePermalink = (permalink: string): string => createPath(BASE_PATHNAME, permalink);
