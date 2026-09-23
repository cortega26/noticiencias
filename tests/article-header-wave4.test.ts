import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

// Wave 4 (P1-04/P1-05): evidence header chips, "Lo esencial" capped at 3
// bullets per visible block, "Qué cambia" as prose, old block names
// gone from article HTML.
function loadSlug(slug: string) {
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
  return load(fs.readFileSync(candidates[0], 'utf8'));
}

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
