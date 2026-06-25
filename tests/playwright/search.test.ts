/**
 * Search page E2E tests.
 * Verifies the search index loads and the search interface works.
 */

import { test, expect } from '@playwright/test';

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
  expect(Array.isArray(data)).toBe(true);
  // Should have at least some entries
  expect(data.length).toBeGreaterThan(0);
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
