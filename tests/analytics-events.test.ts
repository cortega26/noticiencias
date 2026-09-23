import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARTICLE_READ_EVENTS,
  externalHost,
  readProgress,
  trackEvent,
} from '../src/utils/browser/analytics-events';

describe('trackEvent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a silent no-op while GA is off (no window.gtag)', () => {
    vi.stubGlobal('window', {});
    expect(() => trackEvent('search', { search_term: 'x' })).not.toThrow();
  });

  it('sends a beacon-transport event through gtag with the given params', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    trackEvent('outbound_source_click', { link_domain: 'nature.com' });
    expect(gtag).toHaveBeenCalledWith('event', 'outbound_source_click', {
      transport_type: 'beacon',
      link_domain: 'nature.com',
    });
  });

  it('defaults to no extra params', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    trackEvent('article_50');
    expect(gtag).toHaveBeenCalledWith('event', 'article_50', { transport_type: 'beacon' });
  });

  it('never lets a throwing gtag break the page', () => {
    vi.stubGlobal('window', {
      gtag: () => {
        throw new Error('boom');
      },
    });
    expect(() => trackEvent('newsletter_submit')).not.toThrow();
  });
});

describe('externalHost', () => {
  const origin = 'https://noticiencias.com';

  it('returns the hostname of external links', () => {
    expect(externalHost('https://www.nature.com/articles/x', origin)).toBe('www.nature.com');
  });

  it('returns null for same-origin absolute and relative links', () => {
    expect(externalHost('https://noticiencias.com/blog/', origin)).toBeNull();
    expect(externalHost('/blog/', origin)).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(externalHost('http://[bad', origin)).toBeNull();
  });
});

describe('readProgress', () => {
  it('is 0 for an empty element', () => {
    expect(readProgress({ top: 0, height: 0 }, 800)).toBe(0);
  });

  it('measures how much of the element has passed the viewport bottom', () => {
    // 1000px tall element whose top is 250px below the viewport top, 1000px viewport.
    expect(readProgress({ top: 250, height: 1000 }, 1000)).toBe(0.75);
    // Element top is below the fold: nothing read yet.
    expect(readProgress({ top: 1200, height: 1000 }, 1000)).toBeLessThan(0);
    // Scrolled past the whole element.
    expect(readProgress({ top: -2000, height: 1000 }, 1000)).toBeGreaterThan(1);
  });

  it('maps read thresholds to the article funnel events', () => {
    expect(ARTICLE_READ_EVENTS).toEqual([
      { threshold: 50, event: 'article_50' },
      { threshold: 90, event: 'article_90' },
    ]);
  });

  it('crosses the 90% threshold exactly at nine tenths read', () => {
    expect(readProgress({ top: 99, height: 1000 }, 1000)).toBeGreaterThanOrEqual(0.9);
    expect(readProgress({ top: 101, height: 1000 }, 1000)).toBeLessThan(0.9);
  });
});
