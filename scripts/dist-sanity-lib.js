import path from 'node:path';

/**
 * Pure classifiers shared by `scripts/dist-sanity.js` (plan 015 Step 3).
 *
 * This module executes nothing on import: it only defines and exports the
 * route/image/metadata classifiers so they can be unit-tested in isolation.
 * The function bodies are verbatim copies of the originals in
 * `scripts/dist-sanity.js` — no logic change.
 */

export function slugifySegment(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolvePostRoute(fileName, data) {
  const permalink = typeof data.permalink === 'string' ? data.permalink.trim() : '';
  if (permalink) {
    return `/${permalink.replace(/^\/+|\/+$/g, '')}/`;
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const firstCategory = typeof categories[0] === 'string' ? categories[0].trim() : '';
  if (!firstCategory) {
    return null;
  }

  return `/${slugifySegment(firstCategory)}/${path.basename(fileName, path.extname(fileName))}/`;
}

export function getFrontmatterImageSource(data) {
  if (typeof data.image === 'string') {
    return data.image.trim();
  }
  if (data.image && typeof data.image === 'object' && typeof data.image.src === 'string') {
    return data.image.src.trim();
  }
  return '';
}

export function isAliasPath(src = '') {
  return src.startsWith('~/') || src.startsWith('@/');
}

export function isResolvableImageSrc(src = '') {
  return (
    Boolean(src) &&
    !isAliasPath(src) &&
    (src.startsWith('/') ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:'))
  );
}

export function isAvifUrl(src = '') {
  return /\.avif(?:[?#].*)?$/i.test(src);
}

export function isDefaultRenderedImageUrl(src = '') {
  const value = String(src).toLowerCase();
  return (
    value.includes('/default.') ||
    value.endsWith('/default.png') ||
    value.includes('posts/default.')
  );
}

export function readMeta($, selector) {
  return ($(selector).attr('content') || '').trim();
}
