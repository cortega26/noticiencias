/**
 * Extracts the search query from a URL query string.
 * Defaults to `window.location.search`, so this module is browser-only.
 */
export function getQueryFromUrl(searchString = window.location.search): string {
  const params = new URLSearchParams(searchString);
  return (params.get('q') || '').trim();
}

/**
 * Updates the browser URL with the search query without reloading.
 * If query is empty, removes the parameter.
 */
export function updateUrlWithQuery(query: string): void {
  const url = new URL(window.location.href);
  const term = query.trim();

  if (term) {
    url.searchParams.set('q', term);
  } else {
    url.searchParams.delete('q');
  }

  window.history.pushState({ path: url.toString() }, '', url.toString());
}
