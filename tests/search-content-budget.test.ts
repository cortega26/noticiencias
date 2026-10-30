import { describe, expect, it } from 'vitest';
import MiniSearch from 'minisearch';
import { buildSearchArtifact } from '../src/utils/build-search-index';
import { normalizeQuery } from '../src/utils/search';
import { MINI_SEARCH_OPTIONS } from '../src/utils/search-config';
import { processSearchTerm } from '../src/utils/search-stop-words';

describe('full-text search index', () => {
  it('finds terms at the start, middle, and end of a long article body', () => {
    const body = [
      'inicioarticulo',
      'relleno '.repeat(1_000),
      'centroarticulo',
      'relleno '.repeat(1_000),
      'finalarticulo',
    ].join(' ');
    const artifact = buildSearchArtifact([
      {
        title: 'Artículo largo',
        url: '/articulo-largo/',
        description: 'Resumen neutral.',
        content: body,
      },
    ]);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    for (const marker of ['inicioarticulo', 'centroarticulo', 'finalarticulo']) {
      const results = index.search(normalizeQuery(marker));
      expect(results).toHaveLength(1);
      expect(artifact.store[results[0].id].url).toBe('/articulo-largo/');
    }
  });

  it('keeps titles, excerpts, and tags searchable', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'TituloUnico',
        url: '/titulo/',
        description: 'DescripcionUnica',
        content: 'cuerpo indexable',
        tags: ['etiquetaunica'],
      },
    ]);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    for (const term of ['titulo', 'descripcion', 'etiqueta']) {
      expect(index.search(term)).toHaveLength(1);
    }
  });

  it('filters function words while preserving negation and content terms', () => {
    expect(processSearchTerm('de')).toBeNull();
    expect(processSearchTerm('no')).toBe('no');
    expect(processSearchTerm('estado')).toBe('estado');
    expect(processSearchTerm('era')).toBe('era');

    const artifact = buildSearchArtifact([
      {
        title: 'Resultados del experimento',
        url: '/experimento/',
        description: 'Un ensayo independiente.',
        content: 'La evidencia no demuestra mejora.',
      },
      {
        title: 'Reporte general',
        url: '/reporte/',
        description: 'Notas editoriales.',
        content: 'En esa era, el estado cambió.',
      },
    ]);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    expect(index.search('no demuestra').map((result) => artifact.store[result.id].url)).toContain(
      '/experimento/'
    );
    expect(index.search('estado').map((result) => artifact.store[result.id].url)).toContain(
      '/reporte/'
    );
    expect(index.search('era').map((result) => artifact.store[result.id].url)).toContain(
      '/reporte/'
    );
    expect(index.search('de')).toHaveLength(0);
  });

  it('does not copy article bodies into the result store', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Artículo',
        url: '/articulo/',
        description: 'Resumen',
        content: 'texto que sí se indexa',
      },
    ]);

    expect(artifact.store['0']).not.toHaveProperty('content');
  });
});
