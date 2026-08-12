/**
 * Search page E2E tests.
 * Verifies the search index loads and the search interface works.
 */

import { test, expect } from '@playwright/test';

// Trailing-slash investigation concluded 2026-08-11 (plan 031): production
// serves the slash form as canonical (301s no-slash routes, 200 on the
// slash form), and config.yaml now sets trailingSlash: true so the local
// build matches the deployed site. Previously the local build 404'd on
// `/buscar/` while production served 200 — stale config, now fixed.
test('search page loads with input field', async ({ page }) => {
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
