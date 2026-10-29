import { describe, expect, it } from 'vitest';
import lunr from 'lunr';
import {
  buildSearchArtifact,
  sampleSearchContent,
  SEARCH_INDEX_CONTENT_MAX_LENGTH,
} from '../src/utils/build-search-index';

describe('bounded search content', () => {
  it('leaves short content unchanged and bounds long content', () => {
    const short = 'búsqueda corta';
    expect(sampleSearchContent(short)).toBe(short);

    const long = `inicio ${'relleno '.repeat(1_000)} final`;
    const sampled = sampleSearchContent(long);
    expect(sampled.length).toBeLessThanOrEqual(SEARCH_INDEX_CONTENT_MAX_LENGTH);
    expect(sampled).toContain('inicio');
    expect(sampled).toContain('final');
  });

  it('keeps searchable terms from evenly spaced parts of a long article', () => {
    const words = Array.from({ length: 1_000 }, () => 'relleno');
    const markers = [
      'inicioarticulo',
      'primeracuarta',
      'centroarticulo',
      'terceracuarta',
      'finalarticulo',
    ];
    for (const [index, position] of [25, 255, 485, 715, 970].entries()) {
      words.splice(position, 0, markers[index]);
    }

    const artifact = buildSearchArtifact([
      {
        title: 'Artículo de prueba',
        url: '/articulo-prueba/',
        description: 'Resumen neutral.',
        content: words.join(' '),
        tags: [],
      },
    ]);
    const index = lunr.Index.load(artifact.index as object);

    for (const marker of markers) {
      const results = index.search(`${marker}*`);
      expect(results).toHaveLength(1);
      expect(artifact.store[results[0].ref].url).toBe('/articulo-prueba/');
    }
  });

  it('keeps title, description, and tags searchable independently of body sampling', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Título único',
        url: '/titulo/',
        description: 'Descripción única',
        content: `cuerpo ${'relleno '.repeat(1_000)}`,
        tags: ['etiquetaunica'],
      },
    ]);
    const index = lunr.Index.load(artifact.index as object);

    for (const term of ['titulo', 'descripcion', 'etiquetaunica']) {
      expect(index.search(`${term}*`)).toHaveLength(1);
    }
  });
});
