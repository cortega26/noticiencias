/**
 * Analytics consent (plan 009, ADR-0012): Google Consent Mode v2, advanced.
 *
 * Nothing here touches `window` at import time, so Astro frontmatter may import
 * the constants and `buildConsentBootstrap`; only the storage helpers reach for
 * `localStorage`, and only when called (LAW-F3). Every helper takes an optional
 * `storage` so tests can inject a fake one.
 *
 * Only `analytics_storage` is ever granted. `ad_storage`, `ad_user_data` and
 * `ad_personalization` stay denied (ADR-0012: Google Signals off).
 */

export const CONSENT_STORAGE_KEY = 'nc-consent';

/** Bump to re-ask everyone when the purposes described by the banner change. */
export const CONSENT_VERSION = 1;

export type ConsentDecision = 'granted' | 'denied';

export interface StoredConsent {
  v: number;
  decision: ConsentDecision;
  ts: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The GA branch renders only for a real `G-` Measurement ID. */
export function isAnalyticsEnabled(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('G-');
}

function isDecision(value: unknown): value is ConsentDecision {
  return value === 'granted' || value === 'denied';
}

/** Returns the stored decision, or null when unset, stale or unreadable. */
export function readConsent(storage?: StorageLike): ConsentDecision | null {
  try {
    // Resolved inside the try: merely touching `window.localStorage` throws a
    // SecurityError when site data is blocked.
    const raw = (storage ?? window.localStorage).getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null;
    return parsed?.v === CONSENT_VERSION && isDecision(parsed.decision) ? parsed.decision : null;
  } catch {
    // Storage blocked (private window, site data disabled) or corrupt JSON:
    // treat as "never asked" rather than crash the page.
    return null;
  }
}

/** Persists the decision. Returns false when storage is unavailable. */
export function writeConsent(
  decision: ConsentDecision,
  storage?: StorageLike,
  now: number = Date.now()
): boolean {
  try {
    const value: StoredConsent = { v: CONSENT_VERSION, decision, ts: now };
    (storage ?? window.localStorage).setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** The `gtag('consent', 'update', ...)` payload for a decision. */
export function consentUpdateFor(decision: ConsentDecision): {
  analytics_storage: ConsentDecision;
} {
  return { analytics_storage: decision };
}

/**
 * Inline script for `<head>`. Order is load-bearing: the consent `default`
 * (all four signals denied) and any stored `update` must be queued before
 * `config`, and all of it before gtag.js loads, or `_ga` can be written before
 * consent is known. The stored decision is applied synchronously, which is why
 * no `wait_for_update` is needed.
 *
 * Kept as a string because it must run synchronously in `<head>`, before any
 * module script; `tests/consent.test.ts` executes it to prove the ordering.
 */
export function buildConsentBootstrap(measurementId: string): string {
  return `window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;
gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
try {
  var stored = JSON.parse(window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}));
  if (stored && stored.v === ${CONSENT_VERSION} && stored.decision === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
} catch (e) {}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)});`;
}
