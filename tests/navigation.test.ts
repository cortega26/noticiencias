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

import { headerData, footerData } from '../src/navigation';
import { configuredCategorySections } from '../src/utils/categorySections';

interface MenuEntry {
  text?: string;
  href?: string;
  links?: MenuEntry[];
}

describe('navigation data', () => {
  it('keeps the primary header at six content entries', () => {
    expect(headerData.links.map((link) => link.text)).toEqual([
      'Ciencia',
      'Astronomía',
      'Salud',
      'Tecnología',
      'Editorial',
      'Más',
    ]);
  });

  it('nests science sub-disciplines under Ciencia instead of competing with it', () => {
    const ciencia = headerData.links.find((link) => link.text === 'Ciencia') as MenuEntry;

    expect(ciencia.links?.map((link) => link.text)).toEqual([
      'Toda la sección',
      'Física',
      'Química',
      'Biología',
    ]);

    const topLevelTexts = headerData.links
      .filter((link) => !('links' in link))
      .map((link) => link.text);
    expect(topLevelTexts).not.toContain('Física');
    expect(topLevelTexts).not.toContain('Química');
    expect(topLevelTexts).not.toContain('Biología');
  });

  it('keeps Arqueología and Series under the overflow menu', () => {
    const overflow = headerData.links.find((link) => link.text === 'Más') as MenuEntry;

    expect(overflow.links?.map((link) => link.text)).toEqual(['Arqueología', 'Series']);
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
