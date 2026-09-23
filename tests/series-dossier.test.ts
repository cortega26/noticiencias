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

describe('series dossiers (P1-10)', () => {
  it('renders the dossier header with description, count, update and starting point', () => {
    const page = load(readDistHtml('/series/espacio/'));

    expect(page('h1').text()).toContain('Espacio');
    const header = page('h1').closest('header');
    expect(header.text()).toContain('artículos');
    expect(header.text()).toContain('Actualizada el');
    expect(header.find('a:contains("Empieza aquí")').length).toBe(1);
  });

  it('orders the dossier as numbered parts from first to last', () => {
    const page = load(readDistHtml('/series/espacio/'));
    const parts = page('ol > li > p')
      .map((_, el) => page(el).text().trim())
      .get();

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toBe('Parte 1');
    expect(parts.at(-1)).toBe(`Parte ${parts.length}`);
  });

  it('lists dossiers with description, count and update on the series index', () => {
    const page = load(readDistHtml('/series/'));
    const cards = page('a[href^="/series/"]');

    expect(cards.length).toBeGreaterThan(0);
    expect(page('body').text()).toContain('artículos');
    expect(page('body').text()).toContain('Actualizada el');
  });
});
