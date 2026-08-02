import type { SearchDocument } from '~/utils/search';

export interface LunrResult {
  ref: string;
  score: number;
  matchData: unknown;
}

interface LunrIndex {
  search(query: string): LunrResult[];
}

interface LunrStatic {
  Index: { load(serialized: unknown): LunrIndex };
}

let index: LunrIndex | null = null;
let store: Record<string, SearchDocument> = {};
let indexPromise: Promise<LunrIndex> | null = null;

/**
 * Módulo browser-only: carga el índice de búsqueda precompilado
 * (`/search.json`) una sola vez y comparte la promesa entre el diálogo
 * del header y la página `/buscar/`. El arranque es diferido: `loadIndex`
 * solo se invoca al primer uso (foco o apertura del diálogo).
 */
async function fetchIndex(): Promise<LunrIndex> {
  const response = await fetch('/search.json', { cache: 'force-cache' });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const artifact = await response.json();

  if (!artifact || typeof artifact !== 'object') {
    throw new Error('El índice de búsqueda tiene un formato inválido.');
  }
  if (artifact.version !== 1) {
    throw new Error('La versión del índice de búsqueda no es compatible.');
  }
  if (!artifact.index || !artifact.store) {
    throw new Error('El índice de búsqueda está incompleto.');
  }

  store = artifact.store as Record<string, SearchDocument>;

  const lunrModule = await import('lunr');
  const lunr = lunrModule.default as LunrStatic;
  return lunr.Index.load(artifact.index);
}

/** Carga el índice; idempotente y cacheado entre llamadas. */
export function loadIndex(): Promise<LunrIndex> {
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

/** Devuelve true cuando el índice ya está disponible en memoria. */
export function isIndexReady(): boolean {
  return index !== null;
}

/** Ejecuta una consulta Lunr ya normalizada (con sufijos `*` si aplica). */
export function search(query: string): Array<{ ref: string; score: number; doc: SearchDocument }> {
  if (!index) return [];
  return index
    .search(query)
    .map((result) => ({ ref: result.ref, score: result.score, doc: store[result.ref] }))
    .filter((result): result is { ref: string; score: number; doc: SearchDocument } =>
      Boolean(result.doc)
    );
}

/** Últimos posts del índice, ordenados por fecha descendente. */
export function getRecentPosts(count: number): SearchDocument[] {
  return Object.values(store)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, count);
}
