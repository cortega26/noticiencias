/**
 * Shared Playwright test with a hermetic analytics setup (plan 009).
 *
 * `src/config.yaml` now ships GA4 and the Cloudflare beacon ON, so every page
 * would otherwise load real Google/Cloudflare scripts. From `localhost`,
 * Cloudflare rejects the beacon's POST (CORS: the origin is not the registered
 * host), which floods the console and breaks the lifecycle tests, and the
 * visible consent banner covers the footer while axe audits it.
 *
 * So, for every test using this fixture:
 *  - third-party analytics hosts are stubbed (the suite makes no calls to them);
 *  - the consent choice is already stored, so the banner stays out of the way.
 *    Tests that exercise the banner itself live in tests/playwright-consent/,
 *    which builds with the banner undecided.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '../../src/utils/browser/consent';

const ANALYTICS_HOSTS =
  /(googletagmanager|google-analytics|analytics\.google|cloudflareinsights)\.com/;

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.route(ANALYTICS_HOSTS, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
    );
    await page.addInitScript(
      ([key, version]) => {
        window.localStorage.setItem(
          key as string,
          JSON.stringify({ v: version, decision: 'denied', ts: 0 })
        );
      },
      [CONSENT_STORAGE_KEY, CONSENT_VERSION] as const
    );
    await use(page);
  },
});

export { expect };
export type { Page };
