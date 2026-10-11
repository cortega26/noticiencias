/**
 * Shared search-result rendering (plan 017 step 2, search-owned browser module).
 *
 * Single home for the result-card builders + status strings used by both the
 * header dialog (`HeaderSearch.astro`) and the `/buscar/` page
 * (`SearchInterface.astro`). Dialog focus/keyboard and page URL-sync stay in
 * their components (LAW-F4); only the duplicated card + string decisions
 * live here (LAW-F5: feature-owned, never generic utils/).
 *
 * Thumbnail behavior: `doc.image` renders a thumbnail column when present and
 * the card collapses to a single column when absent. The search artifact no
 * longer ships per-doc images (Stream C slim), but older cached artifacts
 * may still carry `image`, so the conditional stays (backward-compatible).
 */

import type { SearchDocument } from '~/utils/search';

/** Status line for the header dialog when results exist. */
export function dialogCountMessage(count: number): string {
  return `${count} resultados.`;
}

/** Status line for the header dialog when nothing matches. */
export function dialogEmptyMessage(query: string): string {
  return `Sin resultados para "${query}".`;
}

/** Status line for the `/buscar/` page when results exist. */
export function pageCountMessage(count: number): string {
  return `Se encontraron ${count} resultados.`;
}

/** `Categoría · 12 ene 2026` meta line; empty segments are dropped. */
export function formatSearchMeta(categories: unknown, date: unknown): string {
  const category = Array.isArray(categories) ? categories[0] : '';
  const formattedDate =
    typeof date === 'string' && date
      ? new Intl.DateTimeFormat('es', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(date))
      : '';
  return [category, formattedDate].filter(Boolean).join(' · ');
}

/** Tag line for the page card; empty string when no tags. */
export function formatSearchTags(tags: SearchDocument['tags']): string {
  if (!tags) return '';
  return Array.isArray(tags) ? tags.join(', ') : String(tags);
}

/** Simple dialog row: `li.py-2 > a` with the post title. */
export function buildDialogItem(doc: Pick<SearchDocument, 'url' | 'title'>): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'py-2';
  const link = document.createElement('a');
  link.href = doc.url;
  link.className =
    'block rounded-md px-2 py-1.5 text-sm font-medium text-text-body hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800';
  link.textContent = doc.title;
  li.appendChild(link);
  return li;
}

/**
 * Rich `/buscar/` card. Two-column grid only when a thumbnail exists;
 * otherwise the content would land in the fixed 160px column and render
 * cramped (Stream C slim ships imageless store entries).
 */
export function buildSearchCard(doc: SearchDocument, position: number): HTMLLIElement {
  const li = document.createElement('li');
  // Two-column grid only when a thumbnail exists; otherwise the content
  // would land in the fixed 160px column and render cramped (Stream C
  // slim ships imageless store entries). Kept backward-compatible with
  // older cached artifacts that still carry `image`.
  li.className = doc.image
    ? 'group grid gap-4 border-b border-border-subtle pb-5 sm:grid-cols-[160px_1fr]'
    : 'group grid gap-4 border-b border-border-subtle pb-5';

  if (doc.image) {
    const imgLink = document.createElement('a');
    imgLink.href = doc.url;
    imgLink.dataset.analyticsSearchResult = String(position);
    imgLink.className = 'block aspect-[4/3] overflow-hidden rounded-md bg-surface-highlight';
    const img = document.createElement('img');
    img.src = doc.image;
    img.alt = doc.title;
    img.className =
      'h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none';
    img.loading = 'lazy';
    imgLink.appendChild(img);
    li.appendChild(imgLink);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'flex min-w-0 flex-col leading-normal';

  const meta = document.createElement('p');
  meta.className = 'mb-2 text-sm text-text-muted';
  meta.textContent = formatSearchMeta(doc.categories, doc.date);
  contentDiv.appendChild(meta);

  const h3 = document.createElement('h3');
  h3.className = 'mb-2 font-heading text-xl font-bold tracking-tight text-text-body';
  const titleLink = document.createElement('a');
  titleLink.href = doc.url;
  titleLink.dataset.analyticsSearchResult = String(position);
  titleLink.className =
    'transition-colors duration-200 hover:text-primary hover:underline underline-offset-4';
  titleLink.textContent = doc.title;
  h3.appendChild(titleLink);
  contentDiv.appendChild(h3);

  const desc = document.createElement('p');
  desc.className = 'mb-3 line-clamp-3 text-sm leading-relaxed text-text-muted';
  desc.textContent = doc.description || '';
  contentDiv.appendChild(desc);

  const tagsText = formatSearchTags(doc.tags);
  if (doc.tags) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'mt-auto text-xs font-medium text-text-muted';
    tagsDiv.textContent = tagsText;
    contentDiv.appendChild(tagsDiv);
  }

  li.appendChild(contentDiv);
  return li;
}

/**
 * Page no-results block. Mirrors the previous inline template exactly
 * (same classes, same `#no-results-query` hook); the query is set via
 * `textContent`, never interpolated into HTML.
 */
export function buildNoResults(query: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML =
    '<div class="border-y border-border-subtle py-8 text-text-muted"><p>No se encontraron resultados para <b id="no-results-query"></b>.</p></div>';
  const block = wrapper.firstElementChild as HTMLDivElement;
  const querySpan = block.querySelector('#no-results-query');
  if (querySpan) querySpan.textContent = query;
  return block;
}
