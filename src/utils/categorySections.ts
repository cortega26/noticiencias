export type { CategorySection } from './taxonomy-copy';
export {
  configuredCategorySections,
  getCategorySection,
  getCategoryColors,
  getConfiguredCategoryTaxonomies,
} from './taxonomy-copy';

// Copy lives in the interim taxonomy-copy module until the publication
// contract carries the field (DEC-023/LAW-F1). This file delegates;
// exports stable (no importer changes).
