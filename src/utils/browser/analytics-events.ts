/**
 * GA4 custom events (plan 009 phase 3, ADR-0012; funnel P2-03).
 *
 * Nothing here touches `window` at import time. Every event goes through
 * `window.gtag`, which only exists when GA4 is enabled (see consent.ts), so with
 * the Measurement ID null these calls are silent no-ops. Under advanced Consent
 * Mode, gtag itself decides what leaves the browser; events are not re-gated here.
 *
 * No PII: params are paths, slugs, domains and form ids only. The search event
 * carries the query text and is disclosed as such in `privacidad.md`.
 */

type Gtag = (command: 'event', name: string, params: Record<string, unknown>) => void;

/** The events this site sends. Names follow GA4's recommended events where one exists. */
export type AnalyticsEventName =
  | 'article_view'
  | 'article_50'
  | 'article_90'
  | 'primary_source_click'
  | 'outbound_source_click'
  | 'related_article_click'
  | 'newsletter_impression'
  | 'newsletter_start'
  | 'newsletter_submit'
  | 'series_click'
  | 'topic_click'
  | 'search';

/** Read-depth thresholds of the article body and the event each one emits. */
export const ARTICLE_READ_EVENTS: ReadonlyArray<{
  threshold: number;
  event: AnalyticsEventName;
}> = [
  { threshold: 50, event: 'article_50' },
  { threshold: 90, event: 'article_90' },
];

export function trackEvent(name: AnalyticsEventName, params: Record<string, unknown> = {}): void {
  try {
    (window as unknown as { gtag?: Gtag }).gtag?.('event', name, {
      // `beacon` survives the page unloading, which a newsletter form submit and a
      // target=_blank source click can trigger before a normal request completes.
      transport_type: 'beacon',
      ...params,
    });
  } catch {
    // Analytics must never break the page.
  }
}

/** Hostname of an external link, or null for same-site, relative or malformed hrefs. */
export function externalHost(href: string, currentOrigin: string): string | null {
  try {
    const url = new URL(href, currentOrigin);
    return url.origin === currentOrigin ? null : url.hostname;
  } catch {
    return null;
  }
}

/** Fraction (0..1+) of an element that has scrolled into or past the bottom of the viewport. */
export function readProgress(
  rect: { top: number; height: number },
  viewportHeight: number
): number {
  if (rect.height <= 0) return 0;
  return (viewportHeight - rect.top) / rect.height;
}
