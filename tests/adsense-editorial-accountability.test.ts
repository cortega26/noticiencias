import { describe, expect, it } from 'vitest';

import { loadDistArticle } from './helpers/load-dist-article';

// These published pages previously hid the byline when a source publisher and
// Noticiencias AI were both present. Do not infer human fact-checking from the
// publication owner's identity.
const POSTS = [
  '2026-09-18-noticia-cientifica',
  '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos',
  '2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras',
];

describe('article editorial accountability', () => {
  for (const slug of POSTS) {
    it(`identifies the responsible editor on ${slug}`, () => {
      const $ = loadDistArticle(slug);
      const byline = $('[data-editorial-accountability]');
      expect(byline.length).toBe(1);
      expect(byline.text()).toContain('Responsable editorial:');
      expect(byline.text()).toContain('Carlos Ortega');
      expect(byline.find('a[href="/nosotros/"]').length).toBeGreaterThan(0);

      const schemas = $('script[type="application/ld+json"]')
        .map((_, script) => {
          try {
            return JSON.parse($(script).html() ?? '{}') as { '@type'?: string };
          } catch {
            return {};
          }
        })
        .get();
      const article = schemas.find((schema) => schema['@type'] === 'NewsArticle') as
        | { editor?: { '@type': string; name: string; url: string } }
        | undefined;
      expect(article?.editor).toEqual({
        '@type': 'Person',
        name: 'Carlos Ortega',
        url: 'https://noticiencias.com/nosotros/',
      });
    });
  }

  it('labels AI assistance without inventing individual human review', () => {
    const $ = loadDistArticle('2026-09-18-noticia-cientifica');
    const byline = $('[data-editorial-accountability]').text();
    expect(byline).toContain('Elaboración: síntesis asistida por IA');
    expect(byline).not.toContain('Revisión por Carlos Ortega');
  });

  it('shows a documented correction date, not an invented review date', () => {
    const $ = loadDistArticle(
      '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos'
    );
    const byline = $('[data-editorial-accountability]');
    expect(byline.text()).toContain('Actualizado:');
    expect(byline.find('time[datetime^="2026-10-09"]').length).toBe(1);
  });
});
