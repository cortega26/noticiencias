import type { SearchDocument } from '~/utils/search';
import { MINI_SEARCH_OPTIONS, SEARCH_ARTIFACT_VERSION } from '~/utils/search-config';

interface SearchResult {
  id: string;
  score: number;
}

interface SearchIndex {
  search(query: string): SearchResult[];
}

interface MiniSearchStatic {
  loadJSON(serialized: string, options: typeof MINI_SEARCH_OPTIONS): SearchIndex;
}

let index: SearchIndex | null = null;
let store: Record<string, SearchDocument> = {};
let indexPromise: Promise<SearchIndex> | null = null;

/** Loads the static index once, shared by the header and /buscar/ page. */
async function fetchIndex(): Promise<SearchIndex> {
  const response = await fetch(`/search.json?v=${SEARCH_ARTIFACT_VERSION}`, {
    cache: 'force-cache',
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const artifact = await response.json();

  if (!artifact || typeof artifact !== 'object') {
    throw new Error('El índice de búsqueda tiene un formato inválido.');
  }
  if (artifact.version !== SEARCH_ARTIFACT_VERSION) {
    throw new Error('La versión del índice de búsqueda no es compatible.');
  }
  if (!artifact.index || !artifact.store) {
    throw new Error('El índice de búsqueda está incompleto.');
  }

  store = artifact.store as Record<string, SearchDocument>;

  const miniSearchModule = await import('minisearch');
  const MiniSearch = miniSearchModule.default as unknown as MiniSearchStatic;
  return MiniSearch.loadJSON(JSON.stringify(artifact.index), MINI_SEARCH_OPTIONS);
}

/** Loads the index; idempotent and cached across calls. */
export function loadIndex(): Promise<SearchIndex> {
  if (!indexPromise) {
    indexPromise = fetchIndex()
      .then((loaded) => {
        index = loaded;
        return loaded;
      })
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

export function isIndexReady(): boolean {
  return index !== null;
}

export function search(query: string): Array<{ ref: string; score: number; doc: SearchDocument }> {
  if (!index) return [];
  return index
    .search(query)
    .map((result) => ({ ref: result.id, score: result.score, doc: store[result.id] }))
    .filter((result): result is { ref: string; score: number; doc: SearchDocument } =>
      Boolean(result.doc)
    );
}

export function getRecentPosts(count: number): SearchDocument[] {
  return Object.values(store)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, count);
}
