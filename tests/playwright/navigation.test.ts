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

// Trailing-slash investigation concluded 2026-08-11 (plan 031): production
// serves the slash form as canonical (301s no-slash routes, 200 on the
// slash form), and config.yaml now sets trailingSlash: true so the local
// build matches the deployed site. Previously the local build 404'd on
// `/blog/` while production served 200 — stale config, now fixed.
test('blog archive loads', async ({ page }) => {
  const response = await page.goto('/blog/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
});

test('search page loads', async ({ page }) => {
  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);
  // The page's search input (not the header's, collapsed on mobile).
  await expect(page.locator('#search-box')).toBeVisible();
});

test('404 page for unknown route', async ({ page }) => {
  const response = await page.goto('/este-articulo-no-existe-2026');
  expect(response?.status()).toBe(404);
});
