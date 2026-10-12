import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearSearchQueryFromUrl, getQueryFromUrl } from '../src/utils/browser/search-url.ts';
import { normalizeQuery } from '../src/utils/search.ts';

describe('Search URL Utils', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        search: '',
        href: 'https://noticiencias.com/buscar/',
      },
      history: {
        state: null,
        replaceState: vi.fn(),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('consumes an incoming legacy query once, without persisting it in the URL', () => {
    const browser = window as Window & { __ncIncomingSearchTerm?: string };
    browser.__ncIncomingSearchTerm = '  astrofísica  ';
    expect(getQueryFromUrl()).toBe('astrofísica');
    expect(browser.__ncIncomingSearchTerm).toBeUndefined();
    expect(getQueryFromUrl()).toBe('');
  });

  it('supports parsing an explicitly supplied legacy URL query', () => {
    expect(getQueryFromUrl('?q=  star  ')).toBe('star');
    expect(getQueryFromUrl('?q=manual')).toBe('manual');
    expect(getQueryFromUrl('')).toBe('');
  });

  it('does not put a new free-form search into browser history', () => {
    clearSearchQueryFromUrl();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('strips legacy q but preserves unrelated URL parameters and hash', () => {
    window.location.href =
      'https://noticiencias.com/buscar/?utm_source=social&q=secret%40example.com#main';
    clearSearchQueryFromUrl();
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/buscar/?utm_source=social#main'
    );
  });

  it('normalizes case and diacritics', () => {
    expect(normalizeQuery('  HELLO  ')).toBe('hello');
    expect(normalizeQuery('Energía Oscura')).toBe('energia oscura');
    expect(normalizeQuery('Canción')).toBe('cancion');
    expect(normalizeQuery('Über')).toBe('uber');
    expect(normalizeQuery('')).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeQuery(null as any)).toBe('');
  });
});
