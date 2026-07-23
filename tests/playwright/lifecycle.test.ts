/**
 * Plan 035: Lifecycle idempotency regression test.
 *
 * Verifies that repeated client-side navigation (Astro View Transitions)
 * does not multiply listeners, IntersectionObserver callbacks, or
 * element-bound event handlers. The key regression signal is:
 *   1. No console/page errors after 10 swaps (no detached-node exceptions,
 *      no undefined-property errors from re-attaching to stale elements).
 *   2. The menu toggle opens then closes correctly after navigation
 *      (no double-handler making it a no-op).
 *   3. The IntersectionObserver count grows linearly (one per swap),
 *      not multiplicatively (which would happen if disconnect() were
 *      missing and old observers kept observing new elements).
 *
 * Runs at both mobile-375 (Pixel 5) and desktop-1280 (Desktop Chrome).
 */

import { test, expect } from '@playwright/test';

const ROUNDS = 10;

// Test-mode instrumentation hooks (not shipped to production).
declare global {
  interface Window {
    __observerCount?: number;
    __observerCallbackCount?: number;
    __scrollHandlerCount?: number;
  }
}

test.describe('lifecycle idempotency across page swaps', () => {
  test('no console/page errors after 10 client-side navigations', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');

    // Navigate via client-side <a> clicks (View Transitions), not page.goto.
    for (let i = 0; i < ROUNDS; i++) {
      const homeLink = page.locator('a[href="/"]').first();
      const blogLink = page.locator('a[href="/blog"]').first();
      const target = i % 2 === 0 ? blogLink : homeLink;
      if ((await target.count()) > 0 && (await target.isVisible())) {
        await target.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // No errors about detached nodes, undefined properties, or observer leaks.
    expect(
      consoleErrors,
      `console errors after ${ROUNDS} swaps: ${consoleErrors.join('; ')}`
    ).toEqual([]);
    expect(pageErrors, `page errors after ${ROUNDS} swaps: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('menu toggle opens then closes after navigation (no double-handler)', async ({ page }) => {
    await page.goto('/');

    // Navigate to an article and back to exercise swaps
    const articleLink = page.locator('a[href^="/blog/"], a[href*="/noticias/"]').first();
    if ((await articleLink.count()) > 0) {
      await articleLink.click();
      await page.waitForLoadState('networkidle');
      const homeLink = page.locator('a[href="/"]').first();
      if ((await homeLink.count()) > 0) {
        await homeLink.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Find the menu toggle button (data-aw-toggle-menu)
    const menuToggle = page.locator('[data-aw-toggle-menu]').first();
    if ((await menuToggle.count()) === 0) {
      test.skip(true, 'no menu toggle on this route');
      return;
    }

    // Click to open
    await menuToggle.click();
    await expect(page.locator('#header').first()).toHaveClass(/expanded/);

    // Click again to close — if a double-handler were attached, the second
    // click would toggle it back open (or the first would toggle twice).
    await menuToggle.click();
    await expect(page.locator('#header').first()).not.toHaveClass(/expanded/);
  });

  test('IntersectionObserver count grows linearly, not multiplicatively', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // Inject a counter for IntersectionObserver constructor calls AND
    // callback invocations. addInitScript runs before any page script.
    // Note: addInitScript evaluates as plain JS, not TS — no `as any` syntax.
    await page.addInitScript(() => {
      window.__observerCount = 0;
      window.__observerCallbackCount = 0;
      const OrigIO = window.IntersectionObserver;
      const CountingIO = function (
        cb: IntersectionObserverCallback,
        opts?: IntersectionObserverInit
      ) {
        const wrappedCb: IntersectionObserverCallback = function (entries, observer) {
          window.__observerCallbackCount = (window.__observerCallbackCount || 0) + entries.length;
          return cb(entries, observer);
        };
        const io = new OrigIO(wrappedCb, opts);
        window.__observerCount = (window.__observerCount || 0) + 1;
        return io;
      };
      CountingIO.prototype = OrigIO.prototype;
      window.IntersectionObserver = CountingIO as unknown as typeof IntersectionObserver;
    });

    await page.goto('/');

    // Count observer creations after initial load
    const initialCount = await page.evaluate(() => window.__observerCount || 0);

    // Navigate back and forth 5 times
    let actualNavigations = 0;
    for (let i = 0; i < 5; i++) {
      const homeLink = page.locator('a[href="/"]').first();
      const blogLink = page.locator('a[href="/blog"]').first();
      const target = i % 2 === 0 ? blogLink : homeLink;
      if ((await target.count()) > 0 && (await target.isVisible())) {
        await target.click();
        await page.waitForLoadState('networkidle');
        actualNavigations++;
      }
    }

    const finalCount = await page.evaluate(() => window.__observerCount || 0);
    const swapsCreated = finalCount - initialCount;

    // Each swap should create at most 1 new observer (via astro:after-swap -> start()).
    // Some navigations may not trigger a swap if going to the same route,
    // so the count should be <= actualNavigations. If disconnect() were
    // missing, old observers would still be observing — the regression
    // signal is console errors from detached nodes, not the count itself.
    expect(
      swapsCreated,
      `observer count grew linearly (navigations=${actualNavigations})`
    ).toBeLessThanOrEqual(actualNavigations);

    // Scroll to trigger the observer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Check that callback count is reasonable — if disconnect() were missing,
    // leaked observers would fire callbacks on elements that scrolled into view,
    // causing the callback count to be much higher than expected.
    const callbackCount = await page.evaluate(() => window.__observerCallbackCount || 0);
    // The callback count should be roughly proportional to the number of
    // elements observed, not multiplied by the number of leaked observers.
    // With disconnect(), only the current observer fires. Without it,
    // all previous observers fire too.
    expect(
      callbackCount,
      `callback count reasonable (not multiplied by leaked observers)`
    ).toBeLessThan(swapsCreated * 20);

    // No errors about detached nodes or observer leaks
    expect(consoleErrors, `errors after swaps: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});
