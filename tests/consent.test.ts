import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  buildConsentBootstrap,
  consentUpdateFor,
  isAnalyticsEnabled,
  readConsent,
  writeConsent,
} from '../src/utils/browser/consent';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('isAnalyticsEnabled', () => {
  it('accepts only real G- measurement ids', () => {
    expect(isAnalyticsEnabled('G-ABC123')).toBe(true);
    expect(isAnalyticsEnabled(null)).toBe(false);
    expect(isAnalyticsEnabled(undefined)).toBe(false);
    expect(isAnalyticsEnabled('null')).toBe(false);
    expect(isAnalyticsEnabled('UA-1234')).toBe(false);
    expect(isAnalyticsEnabled(42)).toBe(false);
  });
});

describe('readConsent / writeConsent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null when nothing is stored', () => {
    expect(readConsent(fakeStorage())).toBeNull();
  });

  it('round-trips a decision', () => {
    const storage = fakeStorage();
    expect(writeConsent('granted', storage, 1234)).toBe(true);
    expect(JSON.parse(storage.data[CONSENT_STORAGE_KEY])).toEqual({
      v: CONSENT_VERSION,
      decision: 'granted',
      ts: 1234,
    });
    expect(readConsent(storage)).toBe('granted');
    writeConsent('denied', storage);
    expect(readConsent(storage)).toBe('denied');
  });

  it('ignores a decision stored under an older policy version', () => {
    const storage = fakeStorage({
      [CONSENT_STORAGE_KEY]: JSON.stringify({ v: CONSENT_VERSION - 1, decision: 'granted' }),
    });
    expect(readConsent(storage)).toBeNull();
  });

  it('ignores corrupt or unrecognised values', () => {
    expect(readConsent(fakeStorage({ [CONSENT_STORAGE_KEY]: '{not json' }))).toBeNull();
    expect(readConsent(fakeStorage({ [CONSENT_STORAGE_KEY]: 'null' }))).toBeNull();
    expect(
      readConsent(
        fakeStorage({
          [CONSENT_STORAGE_KEY]: JSON.stringify({ v: CONSENT_VERSION, decision: 'maybe' }),
        })
      )
    ).toBeNull();
  });

  it('degrades to "never asked" when storage throws or is missing', () => {
    expect(readConsent(throwingStorage)).toBeNull();
    expect(writeConsent('granted', throwingStorage)).toBe(false);
  });

  it('falls back to window.localStorage, and survives it being blocked', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    expect(writeConsent('denied')).toBe(true);
    expect(readConsent()).toBe('denied');

    // Touching window.localStorage itself throws when site data is blocked.
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    });
    expect(readConsent()).toBeNull();
    expect(writeConsent('granted')).toBe(false);
  });
});

describe('consentUpdateFor', () => {
  it('only ever touches analytics_storage', () => {
    expect(consentUpdateFor('granted')).toEqual({ analytics_storage: 'granted' });
    expect(consentUpdateFor('denied')).toEqual({ analytics_storage: 'denied' });
  });
});

describe('buildConsentBootstrap', () => {
  /** Runs the real inline script against a fake window and returns the dataLayer as plain arrays. */
  function run(stored?: string, storage: unknown = undefined) {
    const localStorage = storage ?? fakeStorage(stored ? { [CONSENT_STORAGE_KEY]: stored } : {});
    const win: Record<string, unknown> = { localStorage };
    new Function('window', buildConsentBootstrap('G-TEST123'))(win);
    return (win.dataLayer as IArguments[]).map((entry) => Array.from(entry));
  }

  it('queues consent default (all denied) before js and config', () => {
    const [first, ...rest] = run();
    expect(first).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(rest.map((entry) => entry[0])).toEqual(['js', 'config']);
    expect(rest[1]).toEqual(['config', 'G-TEST123']);
  });

  it('applies a stored grant before config, so _ga is never written pre-consent', () => {
    const layer = run(JSON.stringify({ v: CONSENT_VERSION, decision: 'granted', ts: 1 }));
    expect(layer.map((entry) => entry[0] + ':' + (entry[1] ?? ''))).toEqual([
      'consent:default',
      'consent:update',
      'js:' + layer[2][1],
      'config:G-TEST123',
    ]);
    expect(layer[1][2]).toEqual({ analytics_storage: 'granted' });
  });

  it('keeps the default when the stored decision is a denial or a stale version', () => {
    const denied = run(JSON.stringify({ v: CONSENT_VERSION, decision: 'denied' }));
    const stale = run(JSON.stringify({ v: CONSENT_VERSION - 1, decision: 'granted' }));
    for (const layer of [denied, stale]) {
      expect(layer.filter((entry) => entry[1] === 'update')).toHaveLength(0);
    }
  });

  it('survives unreadable storage and still configures GA', () => {
    const layer = run(undefined, throwingStorage);
    expect(layer.map((entry) => entry[0])).toEqual(['consent', 'js', 'config']);
  });

  it('exposes gtag on window for the banner to send updates', () => {
    const win: Record<string, unknown> = { localStorage: fakeStorage() };
    new Function('window', buildConsentBootstrap('G-TEST123'))(win);
    expect(typeof win.gtag).toBe('function');
  });
});
