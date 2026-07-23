/**
 * Build-time Lunr search index generator (server-only).
 *
 * Replaces the browser-side index construction that previously downloaded
 * every post's full `body` and built Lunr in the main thread. Now the
 * serialized index + compact result store are emitted at build time, and
 * the browser only fetches and deserializes.
 *
 * Uses the same fields/boosts as the original browser builder:
 *   ref('url'), field('title', { boost: 10 }), field('description', { boost: 5 }),
 *   field('content'), field('tags')
 *
 * Applies the same accent/case normalization via `normalizeSearchDocument`.
 */
import lunr from 'lunr';
import type { SearchDocument } from './search';
import { normalizeSearchDocument } from './search';

export const SEARCH_ARTIFACT_VERSION = 1;

export interface SearchStoreEntry {
  title: string;
  url: string;
  description: string;
  tags?: string | string[];
  date?: string;
  series?: string;
  image?: string;
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
 * Build the serialized Lunr index + compact result store from a list of
 * search documents. Documents are sorted by URL before indexing to ensure
 * deterministic serialization across clean builds.
 */
export function buildSearchArtifact(documents: SearchDocument[]): SearchArtifact {
  if (!documents || documents.length === 0) {
    throw new Error('FATAL: No documents provided to buildSearchArtifact.');
  }

  // Sort by URL for deterministic output across builds.
  const sorted = [...documents].sort((a, b) => a.url.localeCompare(b.url));

  // Build the compact store (display fields only — no raw content/body).
  const store: Record<string, SearchStoreEntry> = {};
  for (const doc of sorted) {
    store[doc.url] = {
      title: doc.title,
      url: doc.url,
      description: doc.description,
      tags: doc.tags,
      date: doc.date,
      series: doc.series,
      image: doc.image,
    };
  }

  // Build the Lunr index with the same fields/boosts as the original.
  const index = lunr(function (this: lunr.Builder) {
    this.ref('url');
    this.field('title', { boost: 10 });
    this.field('description', { boost: 5 });
    this.field('content');
    this.field('tags');

    sorted.forEach((doc) => {
      this.add(normalizeSearchDocument(doc));
    });
  });

  return {
    version: SEARCH_ARTIFACT_VERSION,
    index: index.toJSON(),
    store,
  };
}
