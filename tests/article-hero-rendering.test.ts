import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const postsDir = path.join(repoRoot, 'src', 'content', 'posts');
const DEFAULT_HERO_IMAGE = '~/assets/images/default.png';

function slugifySegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolvePostRoute(fileName: string, data: Record<string, unknown>): string | null {
  const permalink = typeof data.permalink === 'string' ? data.permalink.trim() : '';
  if (permalink) {
    return `/${permalink.replace(/^\/+|\/+$/g, '')}/`;
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const firstCategory = typeof categories[0] === 'string' ? categories[0].trim() : '';
  if (!firstCategory) {
    return null;
  }

  return `/${slugifySegment(firstCategory)}/${path.basename(fileName, '.md')}/`;
}

function getFrontmatterImageSource(data: Record<string, unknown>): string {
  if (typeof data.image === 'string') {
    return data.image.trim();
  }

  if (
    data.image &&
    typeof data.image === 'object' &&
    'src' in data.image &&
    typeof (data.image as { src?: unknown }).src === 'string'
  ) {
    return ((data.image as { src: string }).src || '').trim();
  }

  return '';
}

function isDefaultRenderedImageUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('/default.') ||
    normalized.endsWith('/default.png') ||
    normalized.includes('posts/default.')
  );
}

function isResolvableImageSrc(value: string): boolean {
  return Boolean(value) && !value.startsWith('~/') && !value.startsWith('@/') && (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:')
  );
}

describe('article hero rendering', () => {
  if (!fs.existsSync(distDir)) {
    throw new Error('Dist directory not found. Run npm run build first.');
  }

  it('renders a hero image inside each built article with frontmatter image data', () => {
    const postFiles = fs
      .readdirSync(postsDir)
      .filter((fileName) => fileName.endsWith('.md'));

    for (const fileName of postFiles) {
      const raw = fs.readFileSync(path.join(postsDir, fileName), 'utf8');
      const { data } = matter(raw);
      if (!data.image) {
        continue;
      }

      const route = resolvePostRoute(fileName, data);
      expect(route, `Unable to resolve built route for ${fileName}`).toBeTruthy();

      const htmlPath = path.join(
        distDir,
        route!.replace(/^\/+|\/+$/g, ''),
        'index.html'
      );
      expect(fs.existsSync(htmlPath), `Built article missing for ${fileName}`).toBe(true);

      const html = fs.readFileSync(htmlPath, 'utf8');
      const $ = load(html);
      const headerImage = $('main article header img');
      expect(
        headerImage.length,
        `Hero image missing in built article ${fileName}`
      ).toBeGreaterThan(0);

      const avifSource = $('main article header picture source[type="image/avif"]');
      if (avifSource.length > 0) {
        const fallbackSrc = headerImage.first().attr('src') ?? '';
        expect(
          fallbackSrc.endsWith('.avif'),
          `AVIF hero in ${fileName} must include a non-AVIF img fallback`
        ).toBe(false);
      }

      const fallbackSrc = headerImage.first().attr('src') ?? '';
      expect(
        isResolvableImageSrc(fallbackSrc),
        `Hero fallback src in ${fileName} must be resolvable`
      ).toBe(true);
      expect(headerImage.first().attr('width'), `Hero fallback width missing in ${fileName}`).toBeTruthy();
      expect(headerImage.first().attr('height'), `Hero fallback height missing in ${fileName}`).toBeTruthy();

      const imageSource = getFrontmatterImageSource(data);
      const ogImage = $('meta[property="og:image"]').attr('content') ?? '';
      if (imageSource && imageSource !== DEFAULT_HERO_IMAGE) {
        expect(ogImage, `og:image missing in ${fileName}`).toBeTruthy();
        expect(
          isDefaultRenderedImageUrl(ogImage),
          `og:image in ${fileName} must not point at the default placeholder`
        ).toBe(false);
      }
    }
  });
});
