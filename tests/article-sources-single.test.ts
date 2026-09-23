import { describe, expect, it } from 'vitest';

import { loadDistArticle } from './helpers/load-dist-article';

// P0-07: source links must render in exactly one block (TrustPanel).
// ArticleRail no longer renders its own "Fuentes" section, so each article
// must have zero bare <h2>Fuentes</h2> and exactly one "Fuentes y
// verificación" panel. (An in-text [Fuente](url) citation inside the prose
// body is intentional and out of scope for this guard.)
const CASES = [
  '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos.md',
  '2026-09-18-noticia-cientifica.md',
];

describe('P0-07 single sources block', () => {
  for (const file of CASES) {
    it(`${file}: one h1, one sources panel, no rail Fuentes section`, () => {
      const $ = loadDistArticle(file.replace(/\.md$/, ''));

      expect($('h1').length).toBe(1);

      const bareFuentes = $('h2').filter((_, el) => $(el).text().trim() === 'Fuentes');
      expect(bareFuentes.length).toBe(0);

      const trustPanel = $('h2').filter((_, el) => $(el).text().includes('Fuentes y verificación'));
      expect(trustPanel.length).toBe(1);
    });
  }
});
