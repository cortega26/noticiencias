import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const distDir = path.join(__dirname, '..', 'dist');

function readDistHtml(route: string) {
  const htmlPath = path.join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  expect(fs.existsSync(htmlPath), `Built HTML missing for ${route}. Run npm run build.`).toBe(true);
  return fs.readFileSync(htmlPath, 'utf8');
}

describe('related content on articles (P2-01)', () => {
  it('labels category peers as Relacionado instead of recent filler', () => {
    const page = load(
      readDistHtml(
        '/arqueologia/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos/'
      )
    );
    const section = page('section').filter(
      (_, el) => page(el).find('h2').first().text().trim() === 'Relacionado'
    );

    expect(section.length).toBe(1);
    const titles = section
      .find('article h2 a')
      .map((_, el) => page(el).text().trim())
      .get();
    expect(titles.length).toBe(2);
    expect(titles.join(' | ')).toContain('Arpones');
    expect(titles.join(' | ')).toContain('Herramientas');
  });

  it('falls back to Más reciente when no signal reaches the threshold', () => {
    const page = load(readDistHtml('/editorial/2026-02-12-bienvenidos/'));
    const headings = page('h2')
      .map((_, el) => page(el).text().trim())
      .get();

    expect(headings).toContain('Más reciente');
    expect(headings).not.toContain('Relacionado');
  });

  it('never ships the old "Posts Relacionados" title', () => {
    const page = load(
      readDistHtml(
        '/arqueologia/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos/'
      )
    );

    expect(page('body').text()).not.toContain('Posts Relacionados');
  });
});
