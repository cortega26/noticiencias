/**
 * Basic site navigation tests.
 * Verifies key pages load and return 200 with correct structure.
 */

import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

test('home page has navigation', async ({ page }) => {
  await page.goto('/');
  // Header should be present
  await expect(page.locator('header').first()).toBeVisible();
});

// FIXME (plan 031, unresolved as of 2026-07-22): production serves
// `/blog/` (trailing slash) as canonical 200 and 301-redirects `/blog`
// to it, but this repo's `config.yaml` sets `trailingSlash: false`, so
// the local build (`astro preview`) does the opposite — `/blog` is 200,
// `/blog/` 404s. Which form is actually intended (stale config vs. a
// hosting-layer override) is a real infra question, not a test bug —
// asked the operator directly rather than guessing either way. Do not
// "fix" this by picking a slash form until that's answered.
test.fixme('blog archive loads', async ({ page }) => {
  const response = await page.goto('/blog/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
});

// FIXME (plan 031, unresolved as of 2026-07-22): same trailing-slash
// question as 'blog archive loads' above, for `/buscar/`.
test.fixme('search page loads', async ({ page }) => {
  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('input[type="search"], input[type="text"]').first()).toBeVisible();
});

test('404 page for unknown route', async ({ page }) => {
  const response = await page.goto('/este-articulo-no-existe-2026');
  expect(response?.status()).toBe(404);
});
