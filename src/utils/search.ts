export interface SearchDocument {
  title: string;
  url: string;
  description: string;
  content: string;
  categories?: string[];
  tags?: string | string[];
  date?: string;
  series?: string;
  image?: string;
}

export interface NormalizedSearchDocument extends SearchDocument {
  tags: string;
}

/**
 * Normalizes a string for search: lowercase, trim, remove diacritics.
 */
export function normalizeQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function normalizeSearchDocument(doc: SearchDocument): NormalizedSearchDocument {
  return {
    ...doc,
    title: normalizeQuery(doc.title),
    description: normalizeQuery(doc.description),
    content: normalizeQuery(doc.content),
    tags: Array.isArray(doc.tags) ? normalizeQuery(doc.tags.join(' ')) : normalizeQuery(doc.tags),
  };
}
