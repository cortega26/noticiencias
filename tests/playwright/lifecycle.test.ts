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

import { test, expect, type Page } from './fixtures';

const ROUNDS = 10;

// Test-mode instrumentation hooks (not shipped to production).
declare global {
  interface Window {
    __swapCount?: number;
    __observerCount?: number;
    __observerCallbackCount?: number;
    __scrollHandlerCount?: number;
  }
}

async function navigateAcrossRoutes(page: Page, rounds: number) {
  await page.evaluate(() => {
    window.__swapCount = 0;
    document.addEventListener('astro:after-swap', () => {
      window.__swapCount = (window.__swapCount ?? 0) + 1;
    });
  });
  for (let i = 0; i < rounds; i++) {
    const path = i % 2 === 0 ? '/blog/' : '/';
    const link = path === '/' ? '#header a[href="/"]' : 'a[href="/blog/"]:visible';
    await page.locator(link).first().click();
    await expect(page).toHaveURL(path);
    await expect.poll(() => page.evaluate(() => window.__swapCount)).toBe(i + 1);
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

    await navigateAcrossRoutes(page, ROUNDS);

    // No errors about detached nodes, undefined properties, or observer leaks.
    expect(
      consoleErrors,
      `console errors after ${ROUNDS} swaps: ${consoleErrors.join('; ')}`
    ).toEqual([]);
    expect(pageErrors, `page errors after ${ROUNDS} swaps: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('menu state resets on desktop resize and after Astro swaps', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 850 });
    await page.goto('/');
    const toggle = page.locator('[data-aw-toggle-menu]');
    const nav = page.locator('#main-navigation');
    const body = page.locator('body');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toHaveClass(/overflow-hidden/);

    await page.setViewportSize({ width: 1280, height: 850 });
    await expect(toggle).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(body).not.toHaveClass(/overflow-hidden/);
    await expect(page.locator('#header')).not.toHaveClass(/h-screen/);
    await expect(nav).toBeVisible();

    await page.setViewportSize({ width: 900, height: 850 });
    await expect(nav).toBeHidden();
    await navigateAcrossRoutes(page, 2);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toBeHidden();
    await expect(body).not.toHaveClass(/overflow-hidden/);
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

    const actualNavigations = 5;
    await navigateAcrossRoutes(page, actualNavigations);

    const finalCount = await page.evaluate(() => window.__observerCount || 0);
    const swapsCreated = finalCount - initialCount;

    // Each verified swap may create at most one replacement observer.
    expect(
      swapsCreated,
      `observer count grew linearly (navigations=${actualNavigations})`
    ).toBeLessThanOrEqual(actualNavigations);

    // Scroll to trigger the observer, then wait for observer callbacks to
    // settle (consecutive idle frames with a stable count) instead of a
    // fixed timeout.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(async () => {
      const count = () => window.__observerCallbackCount || 0;
      let last = -1;
      let stableFrames = 0;
      for (let frame = 0; frame < 60 && stableFrames < 3; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const next = count();
        stableFrames = next === last ? stableFrames + 1 : 0;
        last = next;
      }
    });

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
