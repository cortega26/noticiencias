/**
 * Search page E2E tests.
 * Verifies the search index loads and the search interface works.
 */

import { test, expect } from '@playwright/test';

// FIXME (plan 031, unresolved as of 2026-07-22): production serves
// `/buscar/` (trailing slash) as canonical 200 and 301-redirects
// `/buscar`, but this repo's `config.yaml` (`trailingSlash: false`)
// makes the local build do the opposite — see navigation.test.ts for the
// full finding. Asked the operator directly rather than guessing which
// form is intended; don't "fix" this by picking one.
test.fixme('search page loads with input field', async ({ page }) => {
  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);

  // Search input should be visible
  const searchInput = page.locator('input[type="search"], input[type="text"]').first();
  await expect(searchInput).toBeVisible();
});

test('search index JSON is accessible', async ({ page }) => {
  const response = await page.request.get('/search.json');
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  // Plan 039: the artifact is now a versioned object { version, index, store }
  // instead of a top-level array of documents.
  expect(data).toBeTruthy();
  expect(data.version).toBe(1);
  expect(data.index).toBeTruthy();
  expect(data.store).toBeTruthy();
  const storeEntries = Object.keys(data.store);
  expect(storeEntries.length).toBeGreaterThan(0);
});

test('RSS feed is accessible', async ({ page }) => {
  const response = await page.request.get('/rss.xml');
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toContain('<rss');
  expect(text).toContain('<channel>');
  expect(text).toContain('<title>Noticiencias</title>');
});

test('LLMs.txt is accessible', async ({ page }) => {
  const response = await page.request.get('/llms.txt');
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text.length).toBeGreaterThan(0);
});
