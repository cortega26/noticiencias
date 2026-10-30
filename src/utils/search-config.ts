import type { Options } from 'minisearch';
import { processSearchTerm } from './search-stop-words';

export interface SearchIndexDocument {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string;
}

export const SEARCH_ARTIFACT_VERSION = 3;

export const MINI_SEARCH_OPTIONS: Options<SearchIndexDocument> = {
  fields: ['title', 'description', 'content', 'tags'],
  idField: 'id',
  storeFields: [],
  processTerm: processSearchTerm,
  searchOptions: {
    prefix: true,
    boost: { title: 20, description: 5, tags: 3 },
    processTerm: processSearchTerm,
  },
};
