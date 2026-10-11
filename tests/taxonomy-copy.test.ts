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

import {
  configuredCategorySections,
  getCategoryColors,
  getCategorySection,
  getConfiguredCategoryTaxonomies,
  getSeriesDescription,
  getTopicHub,
} from '../src/utils/taxonomy-copy';
import { buildSeriesDossiers } from '../src/utils/series';
import { makePost } from './helpers/post-factory';

describe('taxonomy-copy interim getters', () => {
  it('returns identical series descriptions through the delegate', () => {
    expect(getSeriesDescription('Espacio')).toContain('mapa del universo');
    expect(getSeriesDescription('No existe')).toBe('Serie de Noticiencias sobre No existe.');

    const dossiers = buildSeriesDossiers([
      makePost({ series: 'Espacio' }),
      makePost({ id: 'b', slug: 'b', series: 'Espacio' }),
    ]);
    expect(dossiers[0].description).toBe(getSeriesDescription('Espacio'));
  });

  it('returns identical topic hubs through the delegate', () => {
    expect(getTopicHub('coral')?.description).toContain('arrecifes');
    expect(getTopicHub('mision')).toBeUndefined();
  });

  it('returns identical category sections through the delegate', () => {
    for (const section of configuredCategorySections) {
      expect(getCategorySection(section.slug)).toEqual(section);
      expect(getCategoryColors(section.slug)).toBe(section.color);
    }
    expect(getCategorySection('no-such')).toBeUndefined();
    expect(getConfiguredCategoryTaxonomies().ciencia).toEqual({
      slug: 'ciencia',
      title: 'Ciencia',
    });
  });
});
