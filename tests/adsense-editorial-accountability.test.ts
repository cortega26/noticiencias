import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import matter from '../scripts/utils/frontmatter-parser.js';
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

  it('uses institutional attribution and links the assistance policy without inventing human review', () => {
    const $ = loadDistArticle('2026-09-18-noticia-cientifica');
    const byline = $('[data-editorial-accountability]').text();
    expect(byline).toContain('Equipo Noticiencias');
    expect(byline).not.toContain('síntesis asistida por IA');
    expect(byline).not.toContain('Revisión por Carlos Ortega');
    expect($('#fuentes-y-limites a[href="/uso-de-ia/"]').text()).toContain(
      'Cómo elaboramos el contenido'
    );
    expect($('#fuentes-y-limites').text()).not.toContain('síntesis asistida por IA');

    const article = $('script[type="application/ld+json"]')
      .map((_, script) => JSON.parse($(script).html() ?? '{}'))
      .get()
      .find((schema) => schema['@type'] === 'NewsArticle');
    expect(article.author).toEqual([
      {
        '@type': 'Organization',
        name: 'Equipo Noticiencias',
        url: 'https://noticiencias.com/nosotros/',
      },
    ]);
    expect($('#fuentes-y-limites').text()).not.toContain('Revisión editorial:');
  });

  it('keeps generated-image provenance visible and the policy accessible', () => {
    const $ = loadDistArticle(
      '2026-10-17-neandertal-herido-y-cuidado-senal-de-empatia-hace-75-000-anos'
    );
    const hero = $('article header figure');
    expect(hero.find('figcaption').text()).toContain('generada con IA');
    expect(hero.find('figcaption').text()).toBe(hero.find('img').attr('alt'));
    expect($('footer a[href="/uso-de-ia/"]').length).toBe(1);
    expect($('[data-analytics-article]').text()).not.toContain('Imagen de portada:');
  });

  it('links licensed hero images to their source and license without adding links to unrelated images', () => {
    const licensed = [
      [
        '2026-05-23-un-cohete-con-un-motor-apagado-y-otro-fallando-llego-al-espacio-y-volvio',
        // Public Wikimedia file URL, not a credential.
        // eslint-disable-next-line no-secrets/no-secrets
        'https://commons.wikimedia.org/wiki/File:SpaceX_Ignition_(54063834163).jpg',
        'https://creativecommons.org/licenses/by/2.0/',
      ],
      [
        '2026-10-29-un-rojo-no-es-igual-para-todos-como-apple-busca-un-color-universal',
        'https://commons.wikimedia.org/wiki/File:001_2020_05_07_Sensor.jpg',
        'https://creativecommons.org/licenses/by-sa/4.0/',
      ],
      [
        '2026-10-27-por-que-una-mujer-de-30-000-anos-obliga-a-reescribir-la-historia-genetica-de-europa',
        // Public Wikimedia file URL, not a credential.
        // eslint-disable-next-line no-secrets/no-secrets
        'https://commons.wikimedia.org/wiki/File:The_entery_of_Isturitz_and_Oxocelhaya_caves_(2024).jpg',
        'https://creativecommons.org/licenses/by/4.0/',
      ],
      [
        '2026-04-06-nuevos-experimentos-desafian-la-afirmacion-sobre-la-deteccion-de-materia-oscura',
        // Public Wikimedia file URL, not a credential.
        // eslint-disable-next-line no-secrets/no-secrets
        'https://commons.wikimedia.org/wiki/File:Artistic_view_of_the_ANAIS-112_set_up.jpg',
        'https://creativecommons.org/licenses/by-sa/4.0/',
      ],
    ];
    for (const [slug, source, license] of licensed) {
      const $ = loadDistArticle(slug);
      const caption = $('article header figure figcaption');
      expect(
        caption
          .find('a')
          .map((_, el) => $(el).attr('href'))
          .get()
      ).toEqual([source, license]);
      expect(caption.find('a[rel="license"]').length).toBe(1);
      expect(caption.text()).toContain($('article header figure img').attr('alt'));
    }
    const unrelated = loadDistArticle('2026-09-18-noticia-cientifica');
    expect(unrelated('article header figure figcaption a').length).toBe(0);
  });

  it('keeps the image disclosure on the article page, not on home cards', () => {
    // The AI-image disclosure is the hero caption of the article page; the home
    // cards keep it only as the image alt text (accessibility), never as a caption.
    const home = load(fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8'));
    const captions = home('figcaption').filter((_, el) =>
      home(el).text().includes('generada con IA')
    );
    expect(captions.length).toBe(0);
    expect(home('img[alt*="generada con IA"]').length).toBeGreaterThan(0);
  });

  it('shows a documented correction date, not an invented review date', () => {
    const slug = '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos';
    const parsed = matter(
      fs.readFileSync(path.join(__dirname, '..', 'src/content/posts', `${slug}.md`), 'utf8')
    );
    const data = parsed.data as Record<string, string>;
    expect(data.corrected_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.correction_summary).toBeTruthy();
    const $ = loadDistArticle(slug);
    const byline = $('[data-editorial-accountability]');
    expect(byline.text()).toContain('Actualizado:');
    expect(byline.find(`time[datetime^="${data.corrected_at}"]`).length).toBe(1);
  });
});
