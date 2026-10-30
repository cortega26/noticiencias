import { describe, it, expect } from 'vitest';
import MiniSearch from 'minisearch';
import { normalizeQuery } from '../src/utils/search';
import { buildSearchArtifact, stripMarkdown } from '../src/utils/build-search-index';
import { MINI_SEARCH_OPTIONS, SEARCH_ARTIFACT_VERSION } from '../src/utils/search-config';

const mockDocuments = [
  {
    title: 'Energía Oscura y el Universo',
    url: '/posts/energia-oscura/',
    description: 'Un estudio sobre la expansión.',
    content: 'Contenido detallado sobre física.',
    tags: ['física', 'espacio'],
    image: 'img1.jpg',
  },
  {
    title: 'Avances en IA',
    url: '/posts/ia/',
    description: 'Inteligencia Artificial moderna.',
    content: 'Redes neuronales y LLMs.',
    tags: ['tecnología', 'ia'],
    image: 'img2.jpg',
  },
];

describe('Search integration', () => {
  it('finds accent-insensitive and case-insensitive queries', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    for (const query of ['energía', 'OSCURA']) {
      const results = index.search(normalizeQuery(query));
      expect(results[0]).toBeTruthy();
      expect(artifact.store[results[0].id].url).toBe('/posts/energia-oscura/');
    }
  });

  it('finds results from tags and complete article text', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    const tagResults = index.search(normalizeQuery('Tecnología'));
    expect(artifact.store[tagResults[0].id].url).toBe('/posts/ia/');

    const contentResults = index.search(normalizeQuery('neuronales'));
    expect(artifact.store[contentResults[0].id].url).toBe('/posts/ia/');
  });

  it('returns no results for unknown terms or stop-word-only queries', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    const index = MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);

    expect(index.search(normalizeQuery('gastronomía'))).toHaveLength(0);
    expect(index.search(normalizeQuery('de la y'))).toHaveLength(0);
  });

  it('builds a versioned, deterministic artifact without storing full content', () => {
    const first = buildSearchArtifact(mockDocuments);
    const second = buildSearchArtifact(mockDocuments);

    expect(first.version).toBe(SEARCH_ARTIFACT_VERSION);
    expect(first.version).toBe(3);
    expect(first.index).toBeTruthy();
    expect(first.store).toBeTruthy();
    expect(Object.keys(first.store)).toHaveLength(2);
    expect(first.store['0'].url).toBe('/posts/energia-oscura/');
    expect(first.store['1'].url).toBe('/posts/ia/');
    expect(Object.values(first.store)).not.toContainEqual(
      expect.objectContaining({ content: expect.any(String) })
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('stripMarkdown', () => {
  it('returns empty for empty input and frontmatter-only content', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('---\ntitle: Test\n---')).toBe('');
  });

  it('removes code blocks and images while keeping image alt text', () => {
    expect(stripMarkdown('```python\nprint(1)\n```')).toBe('');
    const result = stripMarkdown('![Alt text](image.png)');
    expect(result).toContain('Alt text');
    expect(result).not.toContain('image.png');
  });

  it('keeps link text and removes markup, headings, emphasis, and extra whitespace', () => {
    const result = stripMarkdown(
      '## **Heading**\n\n[Click here](https://example.com)\n<div>body</div>\n\n'
    );
    expect(result).toBe('Heading Click here body');
  });
});

describe('buildSearchArtifact edge cases', () => {
  it('throws for an empty document list', () => {
    expect(() => buildSearchArtifact([])).toThrow('No documents provided');
    expect(() => buildSearchArtifact(null as unknown as never[])).toThrow();
  });

  it('supports one document with empty content and sorts the result store by URL', () => {
    const artifact = buildSearchArtifact([
      { title: 'Z', url: '/z/', description: '', content: 'z' },
      { title: 'A', url: '/a/', description: '', content: 'a' },
      { title: 'M', url: '/m/', description: '', content: 'm' },
    ]);

    expect(Object.keys(artifact.store)).toEqual(['0', '1', '2']);
    expect(Object.values(artifact.store).map((entry) => entry.url)).toEqual(['/a/', '/m/', '/z/']);
  });
});
