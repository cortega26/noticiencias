import { describe, expect, it, vi } from 'vitest';

vi.mock('astrowind:config', () => ({
  SITE: { base: '/', trailingSlash: true },
  I18N: { language: 'es' },
  APP_BLOG: {
    list: { pathname: 'blog' },
    category: { pathname: 'categoria' },
    tag: { pathname: 'tema' },
    post: {},
  },
}));

import { buildSeriesDossiers, getSeriesDossier } from '../src/utils/series';
import type { Post } from '../src/types';

function post(overrides: Partial<Post>): Post {
  return {
    id: overrides.id ?? 'post',
    slug: overrides.slug ?? 'post',
    permalink: overrides.permalink ?? 'ciencia/post',
    publishDate: overrides.publishDate ?? new Date('2026-01-01T00:00:00Z'),
    title: overrides.title ?? 'Post title',
    excerpt: overrides.excerpt ?? 'Excerpt',
    image: overrides.image,
    image_alt: overrides.image_alt,
    category: overrides.category,
    tags: overrides.tags ?? [],
    author: overrides.author,
    metadata: {},
    draft: false,
    ...overrides,
  };
}

describe('series dossiers', () => {
  it('groups posts per series in reading order with count and latest date', () => {
    const posts = [
      post({ id: 'a2', series: 'Espacio', publishDate: new Date('2026-08-01T00:00:00Z') }),
      post({ id: 'a1', series: 'Espacio', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'a3', series: 'Espacio', publishDate: new Date('2026-06-01T00:00:00Z') }),
      post({ id: 'plain' }),
    ];

    const [dossier] = buildSeriesDossiers(posts);

    expect(dossier.name).toBe('Espacio');
    expect(dossier.slug).toBe('espacio');
    expect(dossier.count).toBe(3);
    expect(dossier.posts.map((item) => item.id)).toEqual(['a1', 'a3', 'a2']);
    expect(dossier.firstPost.id).toBe('a1');
    expect(dossier.latestDate).toEqual(new Date('2026-08-01T00:00:00Z'));
  });

  it('ranks dossiers by size first', () => {
    const posts = [
      post({ id: 'a1', series: 'Espacio', publishDate: new Date('2026-01-01T00:00:00Z') }),
      post({ id: 'a2', series: 'Espacio', publishDate: new Date('2026-08-01T00:00:00Z') }),
      post({ id: 'a3', series: 'Espacio', publishDate: new Date('2026-06-01T00:00:00Z') }),
      post({
        id: 'b1',
        series: 'Salud que importa',
        publishDate: new Date('2026-09-01T00:00:00Z'),
      }),
      post({
        id: 'b2',
        series: 'Salud que importa',
        publishDate: new Date('2026-09-02T00:00:00Z'),
      }),
      post({
        id: 'c1',
        series: 'IA en la práctica',
        publishDate: new Date('2026-10-01T00:00:00Z'),
      }),
    ];

    expect(buildSeriesDossiers(posts).map((dossier) => dossier.name)).toEqual([
      'Espacio',
      'Salud que importa',
      'IA en la práctica',
    ]);
  });

  it('breaks size ties by latest update, then by name', () => {
    const posts = [
      post({ id: 'a1', series: 'Espacio', publishDate: new Date('2026-08-01T00:00:00Z') }),
      post({ id: 'a2', series: 'Espacio', publishDate: new Date('2026-08-02T00:00:00Z') }),
      post({
        id: 'b1',
        series: 'Salud que importa',
        publishDate: new Date('2026-09-01T00:00:00Z'),
      }),
      post({
        id: 'b2',
        series: 'Salud que importa',
        publishDate: new Date('2026-09-02T00:00:00Z'),
      }),
      post({ id: 'c1', series: 'Aurora', publishDate: new Date('2026-09-02T00:00:00Z') }),
      post({ id: 'c2', series: 'Aurora', publishDate: new Date('2026-09-01T00:00:00Z') }),
    ];

    expect(buildSeriesDossiers(posts).map((dossier) => dossier.name)).toEqual([
      'Aurora',
      'Salud que importa',
      'Espacio',
    ]);
  });

  it('uses the curated description when known and a neutral fallback otherwise', () => {
    const posts = [
      post({ id: 'a1', series: 'Espacio' }),
      post({ id: 'z1', series: 'Serie desconocida' }),
    ];

    const dossiers = buildSeriesDossiers(posts);
    const espacio = dossiers.find((dossier) => dossier.name === 'Espacio');
    const unknown = dossiers.find((dossier) => dossier.name === 'Serie desconocida');

    expect(espacio?.description).toContain('Astronomía');
    expect(unknown?.description).toBe('Serie de Noticiencias sobre Serie desconocida.');
  });

  it('finds a dossier by slug and returns undefined when absent', () => {
    const posts = [post({ id: 'a1', series: 'IA en la práctica' })];

    expect(getSeriesDossier(posts, 'ia-en-la-practica')?.name).toBe('IA en la práctica');
    expect(getSeriesDossier(posts, 'no-existe')).toBeUndefined();
  });

  it('returns an empty list when no post belongs to a series', () => {
    expect(buildSeriesDossiers([post({ id: 'plain' })])).toEqual([]);
  });
});
