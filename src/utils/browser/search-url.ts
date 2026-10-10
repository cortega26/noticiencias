/** Browser-only search URL helpers. Raw user-entered queries never enter analytics URLs. */
type SearchWindow = Window & { __ncIncomingSearchTerm?: string };

/** Read an incoming legacy ?q= link exactly once, after the head privacy guard removes it. */
export function getQueryFromUrl(searchString?: string): string {
  if (searchString !== undefined) {
    return (new URLSearchParams(searchString).get('q') || '').trim();
  }

  const browser = window as SearchWindow;
  if (typeof browser.__ncIncomingSearchTerm === 'string') {
    const term = browser.__ncIncomingSearchTerm;
    delete browser.__ncIncomingSearchTerm;
    return term.trim();
  }
  return (new URLSearchParams(browser.location.search).get('q') || '').trim();
}

/** Defensive cleanup for a query already present when search executes. */
export function clearSearchQueryFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('q')) return;
  url.searchParams.delete('q');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
