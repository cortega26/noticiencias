import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

// P0-07: source links must render in exactly one block (TrustPanel).
// ArticleRail no longer renders its own "Fuentes" section, so each article
// must have zero bare <h2>Fuentes</h2> and exactly one "Fuentes y
// verificación" panel. (An in-text [Fuente](url) citation inside the prose
// body is intentional and out of scope for this guard.)
const CASES = [
  '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos.md',
  '2026-09-18-noticia-cientifica.md',
];

function findArticleHtml(fileName: string): string {
  const slug = path.basename(fileName, '.md');
  const candidates: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html' && full.includes(slug)) candidates.push(full);
    }
  };
  walk(distDir);
  expect(candidates, `No built HTML found for ${slug}`).not.toEqual([]);
  return candidates[0];
}

describe('P0-07 single sources block', () => {
  for (const file of CASES) {
    it(`${file}: one h1, one sources panel, no rail Fuentes section`, () => {
      const html = fs.readFileSync(findArticleHtml(file), 'utf8');
      const $ = load(html);

      expect($('h1').length).toBe(1);

      const bareFuentes = $('h2').filter((_, el) => $(el).text().trim() === 'Fuentes');
      expect(bareFuentes.length).toBe(0);

      const trustPanel = $('h2').filter((_, el) => $(el).text().includes('Fuentes y verificación'));
      expect(trustPanel.length).toBe(1);
    });
  }
});
