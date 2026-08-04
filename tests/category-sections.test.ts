import { describe, expect, it } from 'vitest';

import {
  configuredCategorySections,
  getCategoryColors,
  getConfiguredCategoryTaxonomies,
} from '../src/utils/categorySections';

describe('configured category sections', () => {
  it('keeps editorial and other public sections available as stable taxonomies', () => {
    const taxonomies = getConfiguredCategoryTaxonomies();

    expect(configuredCategorySections.some((section) => section.slug === 'editorial')).toBe(true);
    expect(taxonomies.editorial).toEqual({
      slug: 'editorial',
      title: 'Editorial',
    });
    expect(taxonomies.tecnologia).toEqual({
      slug: 'tecnologia',
      title: 'Tecnología',
    });
  });

  it('returns Tailwind badge classes for every configured category', () => {
    for (const section of configuredCategorySections) {
      const color = getCategoryColors(section.slug);
      expect(color).toBe(section.color);
      expect(color).toMatch(/^bg-.* text-.* hover:/);
    }
  });

  it('returns null for an unmapped category slug', () => {
    expect(getCategoryColors('no-such-category')).toBeNull();
  });
});
