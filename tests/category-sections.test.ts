import { describe, expect, it } from 'vitest';

import { configuredCategorySections, getConfiguredCategoryTaxonomies } from '../src/utils/categorySections';

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
});
