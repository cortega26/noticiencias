/**
 * Build-time MiniSearch index generator (server-only).
 *
 * Uses short, deterministic numeric document references instead of long URL
 * references inside the index. The result store retains
 * each canonical URL, so search scope and result navigation are unchanged.
 *
 * Replaces the browser-side index construction that previously downloaded
 * every post's full `body` and built a search index in the main thread. Now the
 * serialized index + compact result store are emitted at build time, and
 * the browser only fetches and deserializes.
 *
 * The complete normalized body is indexed. Only common English and Spanish
 * Spanish function words are omitted from the postings.
 */
import MiniSearch from 'minisearch';
import type { SearchDocument } from './search';
import { normalizeSearchDocument } from './search';
import { MINI_SEARCH_OPTIONS, SEARCH_ARTIFACT_VERSION } from './search-config';

/**
 * Maximum description length kept in the result store (Stream C slim).
 * Full excerpts remain in frontmatter/RSS; the search store only needs a
 * short snippet for list rendering. Truncation happens at build time.
 */
export const SEARCH_STORE_DESCRIPTION_MAX_LENGTH = 160;

export interface SearchStoreEntry {
  title: string;
  url: string;
  description: string;
  tags?: string | string[];
  date?: string;
  series?: string;
  // Cards do not need an image or the indexed body text.
}

export interface SearchArtifact {
  version: number;
  index: unknown;
  store: Record<string, SearchStoreEntry>;
}

/**
 * Strip Markdown/MDX syntax to indexable text.
 * Removes code fences, inline code, images, links, HTML tags, and
 * frontmatter artifacts, leaving prose for indexing.
 */
export function stripMarkdown(body: string): string {
  return (
    body
      // Remove frontmatter (if present at start)
      .replace(/^---[\s\S]*?---\n?/, '')
      // Remove code fences and their content
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code
      .replace(/`[^`]+`/g, ' ')
      // Remove images: ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
      // Remove links: [text](url) -> text
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1 ')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Remove Markdown headers markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove emphasis markers
      .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
      // Remove blockquote markers
      .replace(/^>\s+/gm, '')
      // Remove list markers
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Build the serialized MiniSearch index + compact result store from a list of
 * search documents. Documents are sorted by URL before indexing to ensure
 * deterministic serialization across clean builds.
 */
export function buildSearchArtifact(documents: SearchDocument[]): SearchArtifact {
  if (!documents || documents.length === 0) {
    throw new Error('FATAL: No documents provided to buildSearchArtifact.');
  }

  // Sort by URL for deterministic output across builds.
  const sorted = [...documents].sort((a, b) => a.url.localeCompare(b.url));

  // Compact store keyed by deterministic short numeric references.
  // Every entry retains its canonical URL for navigation. No raw content,
  // no image URLs. Descriptions truncated to the snippet ceiling.
  const store: Record<string, SearchStoreEntry> = {};
  for (const [id, doc] of sorted.entries()) {
    const rawDescription = typeof doc.description === 'string' ? doc.description : '';
    const description =
      rawDescription.length > SEARCH_STORE_DESCRIPTION_MAX_LENGTH
        ? `${rawDescription.slice(0, SEARCH_STORE_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
        : rawDescription;
    store[String(id)] = {
      title: doc.title,
      url: doc.url,
      description,
      tags: doc.tags,
      date: doc.date,
      series: doc.series,
    };
  }

  const index = new MiniSearch(MINI_SEARCH_OPTIONS);
  index.addAll(
    sorted.map((doc, id) => ({
      ...normalizeSearchDocument(doc),
      id: String(id),
    }))
  );
  const miniArtifact = {
    version: SEARCH_ARTIFACT_VERSION,
    index: index.toJSON(),
    store,
  };

  return miniArtifact;
}
