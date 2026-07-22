import { describe, expect, it, vi } from 'vitest';

vi.mock('astrowind:config', () => ({
  SITE: { base: '/' },
  I18N: { language: 'es' },
  APP_BLOG: {
    list: { pathname: 'blog' },
    category: { pathname: 'categoria' },
    tag: { pathname: 'tema' },
    post: {},
  },
}));

import { headerData, footerData, homeSectionItems } from '../src/navigation';
import { configuredCategorySections } from '../src/utils/categorySections';

describe('navigation data', () => {
  it('builds one home section item per configured category', () => {
    expect(homeSectionItems).toHaveLength(configuredCategorySections.length);
    expect(homeSectionItems[0]).toMatchObject({
      title: configuredCategorySections[0].title,
      description: configuredCategorySections[0].description,
    });
  });

  it('only puts showInHeader categories directly in the header, the rest under "Más"', () => {
    const directLinks = headerData.links.filter((link) => !('links' in link));
    const overflowGroup = headerData.links.find((link) => 'links' in link) as
      | { links: { text: string }[] }
      | undefined;

    const expectedPrimary = configuredCategorySections.filter((c) => c.showInHeader);
    const expectedOverflow = configuredCategorySections.filter((c) => !c.showInHeader);

    // directLinks also includes the trailing static "Series" link.
    expect(directLinks.length).toBe(expectedPrimary.length + 1);
    expect(directLinks.at(-1)).toMatchObject({ text: 'Series' });

    expect(expectedOverflow.length).toBeGreaterThan(0);
    expect(overflowGroup?.links).toHaveLength(expectedOverflow.length);
  });

  it('always exposes a Buscar action', () => {
    expect(headerData.actions).toEqual([
      { text: 'Buscar', href: '/buscar/', icon: 'tabler:search' },
    ]);
  });

  it('lists every configured category section in the footer', () => {
    const sectionsGroup = footerData.links.find((group) => group.title === 'Secciones');
    expect(sectionsGroup?.links).toHaveLength(configuredCategorySections.length);
  });

  it('includes a report-a-problem secondary link', () => {
    const found = footerData.secondaryLinks.some((link) => link.text === 'Reportar un problema');
    expect(found).toBe(true);
  });
});
