/**
 * search-store-slim.test.ts (Stream C — solo 10/week survival)
 *
 * Guards the slimmed search store: no per-doc `image` URLs, descriptions
 * truncated to the snippet ceiling, index still searchable. Prevents
 * regressions that would push `search.json` back over the 150KB gzip
 * ceiling (scripts/check-search-budget.js).
 */

import { describe, it, expect } from 'vitest';
import {
  buildSearchArtifact,
  SEARCH_STORE_DESCRIPTION_MAX_LENGTH,
} from '../src/utils/build-search-index';
import { normalizeQuery } from '../src/utils/search';
import lunr from 'lunr';

describe('search store slim (Stream C)', () => {
  it('store entries carry no image field even when input docs have one', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Con imagen',
        url: '/a',
        description: 'corta',
        content: 'cuerpo indexable',
        tags: ['física'],
        image: 'https://example.com/hero-400px.jpg',
      },
    ]);

    const entry = artifact.store['/a'];
    expect(entry).toBeTruthy();
    expect(entry).not.toHaveProperty('image');
    expect(entry).not.toHaveProperty('content');
  });

  it('truncates long descriptions to the snippet ceiling', () => {
    const long = 'x'.repeat(SEARCH_STORE_DESCRIPTION_MAX_LENGTH + 50);
    const artifact = buildSearchArtifact([
      { title: 'Larga', url: '/b', description: long, content: 'cuerpo' },
    ]);

    const entry = artifact.store['/b'];
    expect(entry.description.length).toBeLessThanOrEqual(SEARCH_STORE_DESCRIPTION_MAX_LENGTH);
    // Short descriptions pass through untouched.
    const shortArtifact = buildSearchArtifact([
      { title: 'Corta', url: '/c', description: 'breve', content: 'cuerpo' },
    ]);
    expect(shortArtifact.store['/c'].description).toBe('breve');
  });

  it('slimmed artifact still loads in Lunr and finds accent-insensitive queries', () => {
    const artifact = buildSearchArtifact([
      {
        title: 'Energía Oscura',
        url: '/energia',
        description: 'Un estudio sobre la expansión del universo con datos de seis años.',
        content: 'Contenido detallado sobre física y cosmología observacional.',
        tags: ['física'],
      },
      {
        title: 'Avances en IA',
        url: '/ia',
        description: 'Modelos nuevos.',
        content: 'Redes neuronales.',
        tags: ['tecnología'],
      },
    ]);

    const loaded = lunr.Index.load(artifact.index as object);
    const results = loaded.search(`${normalizeQuery('energía')}*`);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ref).toBe('/energia');
  });
});
