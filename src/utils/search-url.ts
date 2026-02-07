/**
 * Extracts the search query from the current URL query parameters.
 * @param searchString - Optional query string to parse (defaults to window.location.search)
 * @returns The 'q' parameter value or empty string
 */
export function getQueryFromUrl(searchString?: string): string {
  if (typeof window === 'undefined' && !searchString) {
      return '';
  }
  
  const search = searchString || window.location.search;
  const params = new URLSearchParams(search);
  return (params.get('q') || '').trim();
}

/**
* Updates the browser URL with the search query without reloading.
* If query is empty, removes the parameter.
* @param query - The search term
*/
export function updateUrlWithQuery(query: string): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const term = query.trim();

  if (term) {
      url.searchParams.set('q', term);
  } else {
      url.searchParams.delete('q');
  }

  window.history.pushState({ path: url.toString() }, '', url.toString());
}
