import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeQuery, normalizeSearchDocument } from '../src/utils/search';
import { buildSearchArtifact, stripMarkdown } from '../src/utils/build-search-index';

import lunr from 'lunr';

interface LunrBuilder {
  ref(field: string): void;
  field(field: string, options?: { boost?: number }): void;
  add(doc: unknown): void;
}

interface LunrResult {
  ref: string;
  score: number;
  matchData: unknown;
}

interface SearchDocument {
  title: string;
  url: string;
  description: string;
  content: string;
  tags?: string[];
  image?: string;
}

describe('Search Integration', () => {
  let index: { search: (q: string) => LunrResult[] };
  let store: Record<string, SearchDocument> = {};

  // Sample Data (Mocking what search.json.js returns)
  const mockDocuments = [
    {
      title: 'Energía Oscura y el Universo',
      url: '/posts/energia-oscura',
      description: 'Un estudio sobre la expansión.',
      content: 'Contenido detallado sobre física.',
      tags: ['física', 'espacio'],
      image: 'img1.jpg',
    },
    {
      title: 'Avances en IA',
      url: '/posts/ai-advances',
      description: 'Inteligencia Artificial moderna.',
      content: 'Redes neuronales y LLMs.',
      tags: ['tecnología', 'ia'],
      image: 'img2.jpg',
    },
  ];

  beforeEach(() => {
    store = {};
    // Simulate Index Building (Logic from buscar.astro)
    index = lunr(function (this: LunrBuilder) {
      this.ref('url');
      this.field('title', { boost: 10 });
      this.field('description', { boost: 5 });
      this.field('content');
      this.field('tags');

      mockDocuments.forEach((doc) => {
        this.add(normalizeSearchDocument(doc));
        store[doc.url] = doc;
      });
    });
  });

  it('should find results using normalized query', () => {
    const query = 'energía';
    const normalizedQuery = normalizeQuery(query); // "energia"

    const results = index.search(`${normalizedQuery}*`);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ref).toBe('/posts/energia-oscura');
  });

  it('should find results regardless of case', () => {
    const query = 'OSCURA';
    const normalizedQuery = normalizeQuery(query); // "oscura"

    const results = index.search(`${normalizedQuery}*`);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ref).toBe('/posts/energia-oscura');
  });

  it('should find results from tags', () => {
    const query = 'Tecnología';
    const normalizedQuery = normalizeQuery(query); // "tecnologia"

    const results = index.search(`${normalizedQuery}*`);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ref).toBe('/posts/ai-advances');
  });

  it('should return empty for no matches', () => {
    const query = 'Gastronomía';
    const normalizedQuery = normalizeQuery(query);

    const results = index.search(`${normalizedQuery}*`);

    expect(results.length).toBe(0);
  });
});

describe('Build-time search artifact (plan 039)', () => {
  const mockDocuments = [
    {
      title: 'Energía Oscura y el Universo',
      url: '/posts/energia-oscura',
      description: 'Un estudio sobre la expansión.',
      content: 'Contenido detallado sobre física.',
      tags: ['física', 'espacio'],
      image: 'img1.jpg',
    },
    {
      title: 'Avances en IA',
      url: '/posts/ai-advances',
      description: 'Inteligencia Artificial moderna.',
      content: 'Redes neuronales y LLMs.',
      tags: ['tecnología', 'ia'],
      image: 'img2.jpg',
    },
  ];

  it('should produce a versioned artifact with serialized index and store', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    expect(artifact.version).toBe(1);
    expect(artifact.index).toBeTruthy();
    expect(artifact.store).toBeTruthy();
    expect(Object.keys(artifact.store)).toHaveLength(2);
  });

  it('should load the serialized index and reproduce result order', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    const loadedIndex = lunr.Index.load(artifact.index as object);

    // Accent search
    const accentResults = loadedIndex.search(`${normalizeQuery('energía')}*`);
    expect(accentResults.length).toBeGreaterThan(0);
    expect(accentResults[0].ref).toBe('/posts/energia-oscura');

    // Case-insensitive search
    const caseResults = loadedIndex.search(`${normalizeQuery('OSCURA')}*`);
    expect(caseResults.length).toBeGreaterThan(0);
    expect(caseResults[0].ref).toBe('/posts/energia-oscura');

    // Tag search
    const tagResults = loadedIndex.search(`${normalizeQuery('Tecnología')}*`);
    expect(tagResults.length).toBeGreaterThan(0);
    expect(tagResults[0].ref).toBe('/posts/ai-advances');

    // No match
    const noResults = loadedIndex.search(`${normalizeQuery('Gastronomía')}*`);
    expect(noResults.length).toBe(0);
  });

  it('should not include raw content in the store', () => {
    const artifact = buildSearchArtifact(mockDocuments);
    for (const entry of Object.values(artifact.store)) {
      expect(entry).not.toHaveProperty('content');
    }
  });

  it('should produce deterministic output across calls', () => {
    const a1 = buildSearchArtifact(mockDocuments);
    const a2 = buildSearchArtifact(mockDocuments);
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });
});

describe('stripMarkdown edge cases (plan 039)', () => {
  it('empty string returns empty string', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('only frontmatter returns empty string', () => {
    expect(stripMarkdown('---\ntitle: Test\n---')).toBe('');
  });

  it('only code fence returns empty string', () => {
    expect(stripMarkdown('```python\nprint(1)\n```')).toBe('');
  });

  it('strips images but keeps alt text', () => {
    const result = stripMarkdown('![Alt text](image.png)');
    expect(result).toContain('Alt text');
    expect(result).not.toContain('image.png');
  });

  it('strips links but keeps link text', () => {
    const result = stripMarkdown('[Click here](https://example.com)');
    expect(result).toContain('Click here');
    expect(result).not.toContain('https://example.com');
  });

  it('removes HTML tags', () => {
    const result = stripMarkdown('<div>content</div>');
    expect(result).toBe('content');
  });

  it('removes heading markers', () => {
    const result = stripMarkdown('## Heading');
    expect(result).toBe('Heading');
  });

  it('removes emphasis markers', () => {
    const result = stripMarkdown('**bold** and _italic_');
    expect(result).toBe('bold and italic');
  });

  it('collapses whitespace', () => {
    const result = stripMarkdown('Multiple\n\n\n  spaces   here');
    expect(result).toBe('Multiple spaces here');
  });
});

describe('buildSearchArtifact edge cases (plan 039)', () => {
  it('empty documents array throws', () => {
    expect(() => buildSearchArtifact([])).toThrow('No documents provided');
  });

  it('null documents throws', () => {
    expect(() => buildSearchArtifact(null as unknown as never[])).toThrow();
  });

  it('single document with empty content works', () => {
    const doc = {
      title: 'Empty',
      url: '/empty',
      description: '',
      content: '',
    };
    const artifact = buildSearchArtifact([doc]);
    expect(artifact.version).toBe(1);
    expect(Object.keys(artifact.store)).toHaveLength(1);
  });

  it('documents are sorted by URL in the store', () => {
    const docs = [
      { title: 'Z', url: '/z', description: '', content: 'z' },
      { title: 'A', url: '/a', description: '', content: 'a' },
      { title: 'M', url: '/m', description: '', content: 'm' },
    ];
    const artifact = buildSearchArtifact(docs);
    const urls = Object.keys(artifact.store);
    expect(urls).toEqual(['/a', '/m', '/z']);
  });
});
