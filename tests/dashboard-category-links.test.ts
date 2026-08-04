/**
 * dashboard-category-links.test.ts
 *
 * Regression guard for the admin dashboard category link bug: the dashboard
 * once hand-rolled slugs with `name.toLowerCase().replace(/\s+/g, '-')`,
 * which kept accented characters (Tecnología -> /categorias/tecnología) while
 * the real taxonomy routes use cleanSlug (limax). The generated links 404'd
 * and only the dist audit in CI caught it. These tests pin the shared slug
 * rule used by both the routes and the dashboard, and verify that every
 * category label in the committed metrics file slugifies to a safe path
 * segment.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

vi.mock('astrowind:config', () => ({
  SITE: { base: '/', trailingSlash: false, site: 'https://example.com' },
  APP_BLOG: {
    isEnabled: true,
    isRelatedPostsEnabled: true,
    postsPerPage: 10,
    list: { isEnabled: true, robots: {}, pathname: 'blog' },
    post: { isEnabled: true, robots: {}, permalink: '%category%/%slug%' },
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

const ASCII_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('dashboard category links', () => {
  it('cleanSlug strips accents the same way the taxonomy routes do', async () => {
    const { cleanSlug } = await import('../src/utils/permalinks');

    const cases: Array<[string, string]> = [
      ['Tecnología', 'tecnologia'],
      ['Astronomía', 'astronomia'],
      ['Arqueología', 'arqueologia'],
      ['Física', 'fisica'],
      ['Química', 'quimica'],
      ['Salud Pública', 'salud-publica'],
    ];

    for (const [name, expected] of cases) {
      expect(cleanSlug(name), `slug for "${name}"`).toBe(expected);
    }
  });

  it('documents why the old hand-rolled slug rule produced broken links', async () => {
    const { cleanSlug } = await import('../src/utils/permalinks');

    // Pre-fix the dashboard built hrefs with name.toLowerCase().replace(/\s+/g, '-')
    // which kept accented characters — the exact bug the dist audit caught.
    const handRolled = 'Tecnología'.toLowerCase().replace(/\s+/g, '-');
    expect(handRolled).not.toMatch(ASCII_SLUG);
    expect(cleanSlug('Tecnología')).toMatch(ASCII_SLUG);
  });

  it('every category in the committed metrics file slugifies to a safe path segment', async () => {
    const METRICS = resolve('data/metrics/pipeline-metrics.json');
    expect(existsSync(METRICS), `missing ${METRICS}`).toBe(true);

    const report = JSON.parse(readFileSync(METRICS, 'utf-8'));
    const names: string[] = report.content.categories.map((c: { name: string }) => c.name);
    expect(names.length).toBeGreaterThan(0);

    const { cleanSlug } = await import('../src/utils/permalinks');
    for (const name of names) {
      expect(cleanSlug(name), `slug for metrics category "${name}"`).toMatch(ASCII_SLUG);
    }
  });
});
