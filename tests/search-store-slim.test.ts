/** Guards the compact result store and full-text MiniSearch index. */

import { describe, it, expect } from 'vitest';
import MiniSearch from 'minisearch';
import {
  buildSearchArtifact,
  SEARCH_STORE_DESCRIPTION_MAX_LENGTH,
} from '../src/utils/build-search-index';
import { normalizeQuery } from '../src/utils/search';
import { MINI_SEARCH_OPTIONS } from '../src/utils/search-config';

describe('search result store', () => {
  it('omits image and article body fields from result entries', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Con imagen',
        url: '/a/',
        description: 'corta',
        content: 'cuerpo indexable',
        tags: ['física'],
        image: 'https://example.com/hero-400px.jpg',
      },
    ]);

    const entry = artifact.store['0'];
    expect(entry).toBeTruthy();
    expect(entry).not.toHaveProperty('image');
    expect(entry).not.toHaveProperty('content');
  });

  it('truncates descriptions only in the display store', () => {
    const long = 'x'.repeat(SEARCH_STORE_DESCRIPTION_MAX_LENGTH + 50);
    const artifact = buildSearchArtifact([
      { title: 'Larga', url: '/b/', description: long, content: long },
    ]);

    expect(artifact.store['0'].description.length).toBeLessThanOrEqual(
      SEARCH_STORE_DESCRIPTION_MAX_LENGTH
    );
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);
    expect(index.search('x'.repeat(10))).toHaveLength(1);

    const shortArtifact = buildSearchArtifact([
      { title: 'Corta', url: '/c/', description: 'breve', content: 'cuerpo' },
    ]);
    expect(shortArtifact.store['0'].description).toBe('breve');
  });

  it('loads and finds accent-insensitive full-text queries', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Energía Oscura',
        url: '/energia/',
        description: 'Un estudio sobre la expansión del universo con datos de seis años.',
        content: 'Contenido detallado sobre física y cosmología observacional.',
        tags: ['física'],
      },
      {
        title: 'Avances en IA',
        url: '/ia/',
        description: 'Modelos nuevos.',
        content: 'Redes neuronales.',
        tags: ['tecnología'],
      },
    ]);

    const loaded = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);
    const results = loaded.search(normalizeQuery('energía'));
    expect(results.length).toBeGreaterThan(0);
    expect(artifact.store[results[0].id].url).toBe('/energia/');
  });
});
