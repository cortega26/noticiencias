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

describe('topic follow via RSS (P2-05)', () => {
  it('offers a topic feed with explicit unfollow instructions on tag pages', () => {
    const page = load(readDistHtml('/temas/coral/'));

    expect(page('h2:contains("Seguir este tema")').length).toBe(1);
    expect(page('body').text()).toContain('dejas de seguirlo');
    expect(page('a[href="/temas/coral/rss.xml"]').length).toBe(1);
  });

  it('builds a per-topic feed with only the tagged stories', () => {
    const feedPath = path.join(distDir, 'temas', 'coral', 'rss.xml');
    expect(fs.existsSync(feedPath), 'Missing tag feed. Run npm run build.').toBe(true);

    const feed = fs.readFileSync(feedPath, 'utf8');
    expect(feed).toContain('Noticiencias — coral');
    expect(feed).toContain(
      '/ciencia/2026-08-27-los-corales-de-galapagos-ocultan-un-secreto-de-el-nino/'
    );
    expect(feed).toContain(
      '/biologia/2026-09-20-pelos-diminutos-la-clave-inesperada-para-la-supervivencia-nocturna-del-coral/'
    );
    expect(feed).not.toContain('2026-02-12-bienvenidos');
  });
});
