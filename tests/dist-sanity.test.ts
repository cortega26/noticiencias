import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';

import {
  getFrontmatterImageSource,
  isAliasPath,
  isAvifUrl,
  isDefaultRenderedImageUrl,
  isResolvableImageSrc,
  readMeta,
  resolvePostRoute,
  slugifySegment,
} from '../scripts/dist-sanity-lib.js';

function articleHtml({
  ogImage = 'https://noticiencias.com/images/uno.jpg',
  heroSrc = '/images/uno.jpg',
  includeAvifSource = false,
}: {
  ogImage?: string;
  heroSrc?: string;
  includeAvifSource?: boolean;
} = {}) {
  const avifSource = includeAvifSource
    ? '<source type="image/avif" srcset="https://www.cdn.noticiencias.com/posts/example.avif 900w" />'
    : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta property="og:image" content="${ogImage}" />
        <meta name="twitter:title" content="Articulo" />
      </head>
      <body>
        <main>
          <article>
            <header>
              <picture>
                ${avifSource}
                <img src="${heroSrc}" alt="Articulo" width="1200" height="630" />
              </picture>
            </header>
          </article>
        </main>
      </body>
    </html>
  `;
}

describe('dist-sanity route classifier', () => {
  it('prefers an explicit permalink over the category fallback', () => {
    expect(resolvePostRoute('2026-01-15-mi-post.md', { permalink: 'ciencia/mi-post' })).toBe(
      '/ciencia/mi-post/'
    );
  });

  it('trims slashes and whitespace from the permalink', () => {
    expect(resolvePostRoute('x.md', { permalink: '  //ciencia/mi-post// ' })).toBe(
      '/ciencia/mi-post/'
    );
  });

  it('falls back to the slugified first category plus the file stem', () => {
    expect(
      resolvePostRoute('2026-01-15-mi-post.md', { categories: ['Ciencia y Tecnología'] })
    ).toBe('/ciencia-y-tecnologia/2026-01-15-mi-post/');
  });

  it('returns null when there is no permalink and no usable category', () => {
    expect(resolvePostRoute('x.md', {})).toBeNull();
    expect(resolvePostRoute('x.md', { categories: [] })).toBeNull();
    expect(resolvePostRoute('x.md', { categories: ['   '] })).toBeNull();
    expect(resolvePostRoute('x.md', { categories: 'ciencia' })).toBeNull();
  });

  it('slugifies accented segments', () => {
    expect(slugifySegment('Física Cuántica')).toBe('fisica-cuantica');
  });
});

describe('dist-sanity frontmatter image classifier', () => {
  it('reads a plain string image source', () => {
    expect(getFrontmatterImageSource({ image: '  /images/uno.jpg ' })).toBe('/images/uno.jpg');
  });

  it('reads an object image source via src', () => {
    expect(getFrontmatterImageSource({ image: { src: '~/assets/images/uno.jpg' } })).toBe(
      '~/assets/images/uno.jpg'
    );
  });

  it('returns empty string when no usable image is present', () => {
    expect(getFrontmatterImageSource({})).toBe('');
    expect(getFrontmatterImageSource({ image: 42 })).toBe('');
    expect(getFrontmatterImageSource({ image: { src: 42 } })).toBe('');
  });
});

describe('dist-sanity image-src classifiers', () => {
  it('flags build-time aliases', () => {
    expect(isAliasPath('~/assets/a.png')).toBe(true);
    expect(isAliasPath('@/assets/a.png')).toBe(true);
    expect(isAliasPath('/images/a.png')).toBe(false);
  });

  it('accepts only built absolute, remote, or data URLs', () => {
    expect(isResolvableImageSrc('/images/a.jpg')).toBe(true);
    expect(isResolvableImageSrc('https://www.cdn.noticiencias.com/a.jpg')).toBe(true);
    expect(isResolvableImageSrc('http://example.com/a.jpg')).toBe(true);
    expect(isResolvableImageSrc('data:image/png;base64,aaa')).toBe(true);
    expect(isResolvableImageSrc('~/assets/a.png')).toBe(false);
    expect(isResolvableImageSrc('images/a.jpg')).toBe(false);
    expect(isResolvableImageSrc('')).toBe(false);
  });

  it('detects AVIF urls including query strings', () => {
    expect(isAvifUrl('https://www.cdn.noticiencias.com/a.avif')).toBe(true);
    expect(isAvifUrl('https://www.cdn.noticiencias.com/a.AVIF?w=900')).toBe(true);
    expect(isAvifUrl('/images/a.jpg')).toBe(false);
  });

  it('detects the default placeholder render', () => {
    expect(isDefaultRenderedImageUrl('https://noticiencias.com/images/default.png')).toBe(true);
    expect(isDefaultRenderedImageUrl('https://noticiencias.com/default.webp')).toBe(true);
    expect(isDefaultRenderedImageUrl('https://www.cdn.noticiencias.com/posts/default.avif')).toBe(
      true
    );
    expect(isDefaultRenderedImageUrl('https://noticiencias.com/images/uno.jpg')).toBe(false);
  });
});

describe('dist-sanity metadata classifier', () => {
  it('reads trimmed meta content from built HTML', () => {
    const $ = load(articleHtml());
    expect(readMeta($, 'meta[property="og:image"]')).toBe(
      'https://noticiencias.com/images/uno.jpg'
    );
    expect(readMeta($, 'meta[property="og:missing"]')).toBe('');
  });

  it('classifies the article header hero from built HTML', () => {
    const $ = load(
      articleHtml({
        heroSrc: 'https://www.cdn.noticiencias.com/posts/example.avif',
        includeAvifSource: true,
      })
    );
    const headerSrc = ($('main article header img').first().attr('src') || '').trim();
    expect(isResolvableImageSrc(headerSrc)).toBe(true);
    expect(isAvifUrl(headerSrc)).toBe(true);
    expect($('main article header picture source[type="image/avif"]').length).toBe(1);
  });

  it('flags an article-specific hero paired with the default og:image', () => {
    const $ = load(
      articleHtml({
        heroSrc: '/images/uno.jpg',
        ogImage: 'https://noticiencias.com/images/default.png',
      })
    );
    expect(isDefaultRenderedImageUrl(readMeta($, 'meta[property="og:image"]'))).toBe(true);
  });
});
