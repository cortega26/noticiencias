import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import { resolveSourceAttribution } from '../src/utils/source-publisher';
import { loadDistArticle } from './helpers/load-dist-article';
import { makePost } from './helpers/post-factory';

describe('resolveSourceAttribution', () => {
  it('separates primary studies from secondary coverage', () => {
    const post = makePost({
      source_url: 'https://doi.org/10.1038/nature16512',
      sources: [
        {
          title: 'A',
          url: 'https://doi.org/10.1038/nature16512',
          publisher: 'Nature',
          role: 'primary',
        },
        {
          title: 'B',
          url: 'https://doi.org/10.1038/s41558-024-01989-1',
          publisher: 'Nature Climate Change',
          role: 'primary',
        },
        {
          title: 'C',
          url: 'https://technologyreview.com/2026/10/12/1145745/x/',
          publisher: 'MIT Technology Review',
          role: 'secondary',
        },
      ],
    });
    expect(resolveSourceAttribution(post)).toEqual({
      primary: ['Nature', 'Nature Climate Change'],
      coverage: 'MIT Technology Review',
    });
  });

  it('does not reinterpret a DOI source_url as coverage when only primaries exist', () => {
    const post = makePost({
      source_url: 'https://doi.org/10.1038/nature16512',
      sources: [
        {
          title: 'A',
          url: 'https://doi.org/10.1038/nature16512',
          publisher: 'Nature',
          role: 'primary',
        },
      ],
    });
    expect(resolveSourceAttribution(post)).toEqual({ primary: ['Nature'], coverage: null });
  });

  it('falls back to the legacy source_url publisher when there are no structured sources', () => {
    const post = makePost({
      source_url: 'https://scientificamerican.com/article/largest-galaxy-survey/',
    });
    expect(resolveSourceAttribution(post)).toEqual({
      primary: [],
      coverage: 'Scientific American',
    });
  });

  it('treats a source without role as secondary (legacy contract)', () => {
    const post = makePost({
      source_url: 'https://newscientist.com/article/1/',
      sources: [{ title: 'NS', url: 'https://newscientist.com/article/1/' }],
    });
    expect(resolveSourceAttribution(post)).toEqual({
      primary: [],
      coverage: 'New Scientist',
    });
  });

  it('derives the publisher from the hostname when none is declared and dedupes', () => {
    const post = makePost({
      sources: [
        { title: 'A', url: 'https://www.nature.com/articles/a', role: 'primary' },
        { title: 'B', url: 'https://nature.com/articles/b', role: 'primary' },
      ],
    });
    expect(resolveSourceAttribution(post)).toEqual({ primary: ['nature.com'], coverage: null });
  });

  it('returns no attribution when the post declares nothing', () => {
    expect(resolveSourceAttribution(makePost())).toEqual({ primary: [], coverage: null });
  });
});

describe('rendered source line', () => {
  const sourceLine = (slug: string) => {
    const $ = loadDistArticle(slug);
    return $('p')
      .filter((_, el) => /^Fuente/.test($(el).text().trim()))
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  };

  it('names the primary studies and the coverage, without a translation label', () => {
    const text = sourceLine(
      '2026-10-12-las-redes-invisibles-que-estan-revitalizando-los-bosques-lluviosos'
    );
    expect(text).toContain('Fuente primaria: Nature, Nature Climate Change');
    expect(text).toContain('Cobertura: MIT Technology Review');
    expect(text).not.toContain('traducción NotiAI');
    expect(text).not.toContain('doi.org');
  });

  it('keeps the translation label for an adaptation of a single secondary article', () => {
    const text = sourceLine('2026-08-28-el-eclipse-solar-de-2027-durara-seis-minutos-y-veintitres');
    expect(text).toContain('Fuente: New Scientist');
    expect(text).toContain('traducción NotiAI');
  });

  it('omits the coverage clause on listing cards', () => {
    const home = load(fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8'));
    const cards = home('p')
      .filter((_, el) => /^Fuente primaria/.test(home(el).text().trim()))
      .map((_, el) => home(el).text())
      .get();
    for (const text of cards) expect(text).not.toContain('Cobertura');
  });
});
