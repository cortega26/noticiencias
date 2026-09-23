import { describe, expect, it } from 'vitest';

import { loadDistArticle as loadSlug } from './helpers/load-dist-article';

// P0-01: verified primary sources outrank secondary coverage.
// - articles with a primary source show "Fuente primaria" + DOI link;
// - secondary entries render under "Cobertura", or "Fuentes" when there is
//   no primary (legacy rendering unchanged);
// - legacy articles without roles never show "Fuente primaria".

describe('P0-01 primary source hierarchy', () => {
  it('Herculano shows primary paper, DOI and secondary coverage', () => {
    const $ = loadSlug('2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos');
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Fuente primaria').length).toBe(1);
    expect($('a[href="https://doi.org/10.1371/journal.pone.0353485"]').length).toBe(1);
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Cobertura').length).toBe(1);
  });

  it('biomedico shows primary preprint with DOI and no invented secondary', () => {
    const $ = loadSlug('2026-09-18-noticia-cientifica');
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Fuente primaria').length).toBe(1);
    expect($('a[href="https://doi.org/10.64898/2026.09.12.751148"]').length).toBe(1);
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Cobertura').length).toBe(0);
  });

  it('legacy articles keep the plain Fuentes heading', () => {
    const $ = loadSlug('2026-08-26-que-revelo-el-adn-de-una-tortuga-que-el-tiempo-habia-borrado');
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Fuente primaria').length).toBe(0);
    expect($('h3').filter((_, el) => $(el).text().trim() === 'Fuentes').length).toBe(1);
  });
});
