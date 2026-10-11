/**
 * Characterization tests for the Metadata.astro SEO assembly path
 * (plan 015 Step 2). Tests the helpers, not the Astro renderer:
 * - getCanonical default canonical assembly (as Metadata.astro calls it
 *   with Astro.url.pathname)
 * - buildHead title/robots/canonical/OG/Twitter emission, including the
 *   twitter:title/:description/:image mirroring of OG values.
 */

import { describe, it, expect, vi } from 'vitest';

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

import { getCanonical } from '../src/utils/permalinks';
import { buildHead } from '../src/components/template/common/buildHead';

function findMeta(tags: ReturnType<typeof buildHead>, key: string, value: string) {
  return tags.filter(
    (t) =>
      t.tag === 'meta' && (t as never as { attrs: Record<string, string> }).attrs[key] === value
  );
}

describe('canonical assembly (Metadata.astro default)', () => {
  it('builds an absolute canonical from a pathname', () => {
    expect(String(getCanonical('/ciencia/mi-articulo'))).toBe(
      'https://noticiencias.com/ciencia/mi-articulo'
    );
  });

  it('emits the canonical as a link tag via buildHead', () => {
    const canonical = String(getCanonical('/ciencia/mi-articulo'));
    const tags = buildHead({ canonical });
    const links = tags.filter((t) => t.tag === 'link');
    expect(links).toContainEqual({ tag: 'link', attrs: { rel: 'canonical', href: canonical } });
  });
});

describe('buildHead title and robots', () => {
  it('applies the title template', () => {
    const tags = buildHead({ title: 'Mi artículo', titleTemplate: '%s | Noticiencias' });
    expect(tags).toContainEqual({ tag: 'title', content: 'Mi artículo | Noticiencias' });
  });

  it('emits robots noindex/nofollow with max-image-preview', () => {
    const tags = buildHead({
      noindex: true,
      nofollow: true,
      robotsProps: { maxImagePreview: 'large' },
    });
    const robots = findMeta(tags, 'name', 'robots');
    expect(robots).toHaveLength(1);
    expect((robots[0] as never as { attrs: Record<string, string> }).attrs.content).toBe(
      'noindex,nofollow,max-image-preview:large'
    );
  });

  it('emits index,follow when robots allow crawling', () => {
    const tags = buildHead({ noindex: false, nofollow: false });
    const robots = findMeta(tags, 'name', 'robots');
    expect((robots[0] as never as { attrs: Record<string, string> }).attrs.content).toBe(
      'index,follow'
    );
  });
});

describe('buildHead OpenGraph assembly', () => {
  it('falls back to config title/description for og:title/og:description', () => {
    const tags = buildHead({
      title: 'Mi artículo',
      description: 'Resumen del artículo',
      openGraph: { url: 'https://noticiencias.com/x', type: 'article' },
    });
    expect(findMeta(tags, 'property', 'og:title')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:description')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:url')).toHaveLength(1);
  });

  it('prefers explicit og title/description over config values', () => {
    const tags = buildHead({
      title: 'Doc title',
      description: 'Doc description',
      openGraph: { title: 'OG title', description: 'OG description' },
    });
    const ogTitle = findMeta(tags, 'property', 'og:title')[0] as never as {
      attrs: Record<string, string>;
    };
    const ogDesc = findMeta(tags, 'property', 'og:description')[0] as never as {
      attrs: Record<string, string>;
    };
    expect(ogTitle.attrs.content).toBe('OG title');
    expect(ogDesc.attrs.content).toBe('OG description');
  });

  it('emits og:image with dimensions and locale/site_name', () => {
    const tags = buildHead({
      openGraph: {
        url: 'https://noticiencias.com/x',
        site_name: 'Noticiencias',
        locale: 'es_ES',
        type: 'website',
        images: [{ url: 'https://noticiencias.com/img.jpg', width: 1200, height: 630 }],
      },
    });
    expect(findMeta(tags, 'property', 'og:image')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:image:width')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:image:height')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:locale')).toHaveLength(1);
    expect(findMeta(tags, 'property', 'og:site_name')).toHaveLength(1);
  });
});

describe('buildHead Twitter mirroring (social-distribution §11)', () => {
  it('mirrors og title/description/image into twitter tags', () => {
    const tags = buildHead({
      title: 'Mi artículo',
      description: 'Resumen',
      openGraph: {
        url: 'https://noticiencias.com/x',
        images: [{ url: 'https://noticiencias.com/img.jpg' }],
      },
      twitter: { cardType: 'summary_large_image' },
    });
    expect(findMeta(tags, 'name', 'twitter:card')).toHaveLength(1);
    expect(findMeta(tags, 'name', 'twitter:title')).toHaveLength(1);
    expect(findMeta(tags, 'name', 'twitter:description')).toHaveLength(1);
    expect(findMeta(tags, 'name', 'twitter:image')).toHaveLength(1);
    const twImage = findMeta(tags, 'name', 'twitter:image')[0] as never as {
      attrs: Record<string, string>;
    };
    expect(twImage.attrs.content).toBe('https://noticiencias.com/img.jpg');
  });

  it('omits twitter:image when og:image is empty (unresolved asset)', () => {
    const tags = buildHead({
      title: 'Mi artículo',
      openGraph: { url: 'https://noticiencias.com/x', images: [{ url: '' }] },
      twitter: { cardType: 'summary' },
    });
    expect(findMeta(tags, 'name', 'twitter:image')).toHaveLength(0);
    // og:image itself is still emitted (possibly empty) — twitter just omits.
    expect(findMeta(tags, 'property', 'og:image')).toHaveLength(1);
  });
});
