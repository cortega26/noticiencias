import { describe, expect, it } from 'vitest';

import { loadDistArticle as loadSlug } from './helpers/load-dist-article';

// Wave 4 (P1-04/P1-05): evidence header chips, "Lo esencial" capped at 3
// bullets per visible block, "Qué cambia" as prose, old block names
// gone from article HTML.

const HERCULANO = '2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos';
const BIOMEDICO = '2026-09-18-noticia-cientifica';

describe('Wave 4 article header (P1-04)', () => {
  it('renders methodology chips from verified metadata', () => {
    const $ = loadSlug(BIOMEDICO);
    const chips = $('ul[aria-label="Datos metodológicos"] li')
      .map((_, el) => $(el).text().trim())
      .get();
    expect(chips.length).toBeLessThanOrEqual(3);
    expect(chips).toContain('Modelo: fases mixtas (ver detalle)');
    expect(chips).toContain('Preprint');
    expect(chips).toContain('Fuente primaria');
  });

  it('renders no chips for legacy articles without evidence data', () => {
    const $ = loadSlug('2026-08-26-que-revelo-el-adn-de-una-tortuga-que-el-tiempo-habia-borrado');
    expect($('ul[aria-label="Datos metodológicos"]').length).toBe(0);
  });
});

describe('Wave 4 pre-body blocks (P1-05)', () => {
  it('caps Lo esencial at 3 bullets per visible block', () => {
    const $ = loadSlug(HERCULANO);
    const sections = $('h2').filter((_, el) => $(el).text().trim() === 'Lo esencial');
    expect(sections.length).toBeGreaterThan(0);
    sections.each((_, el) => {
      expect($(el).closest('section').find('li').length).toBeLessThanOrEqual(3);
    });
  });

  it('renames blocks and drops the old names', () => {
    const $ = loadSlug(BIOMEDICO);
    expect($('h2').filter((_, el) => $(el).text().trim() === 'Qué cambia').length).toBe(1);
    expect($('h2').filter((_, el) => $(el).text().trim() === 'En breve').length).toBe(0);
    expect($('h2').filter((_, el) => $(el).text().trim() === 'En la práctica').length).toBe(0);
  });
});
