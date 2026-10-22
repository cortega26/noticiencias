import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const cases = [
  ['2026-08-26-por-que-tu-sensor-de-glucosa-podria-estar-revelando-mas-de-lo-que-crees', 'Salud'],
  ['2026-10-05-como-una-alga-que-busca-luz-controla-el-cerebro-de-un-mamifero', 'Biología'],
  ['2026-10-12-las-redes-invisibles-que-estan-revitalizando-los-bosques-lluviosos', 'Biología'],
  ['2026-10-12-simulacion-de-guerra-mostro-efecto-inesperado-al-enfriar-la-tierra', 'Ciencia'],
];

describe('editorial categorization preserves published URLs', () => {
  it.each(cases)(
    '%s remains at its existing canonical and reports its corrected section',
    (slug, section) => {
      const path = `/tecnologia/${slug}/`;
      const $ = load(readFileSync(join(process.cwd(), 'dist', path, 'index.html'), 'utf8'));
      expect($('link[rel="canonical"]').attr('href')).toBe(`https://noticiencias.com${path}`);
      const article = $('script[type="application/ld+json"]')
        .map((_, el) => JSON.parse($(el).text()))
        .get()
        .find((schema) => schema['@type'] === 'NewsArticle');
      expect(article.articleSection).toBe(section);
      expect(readFileSync(join(process.cwd(), 'dist/sitemap-0.xml'), 'utf8')).toContain(
        `https://noticiencias.com${path}`
      );
    }
  );
});
