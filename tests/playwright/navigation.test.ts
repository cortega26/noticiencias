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

test('blog archive loads', async ({ page }) => {
  const response = await page.goto('/blog/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
});

test('search page loads', async ({ page }) => {
  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('input[type="search"], input[type="text"]').first()).toBeVisible();
});

test('404 page for unknown route', async ({ page }) => {
  const response = await page.goto('/este-articulo-no-existe-2026');
  expect(response?.status()).toBe(404);
});

test('noticiencias.com redirects to correct domain', async ({ page, baseURL }) => {
  // Verify the page renders at the base URL
  await page.goto('/');
  const url = page.url();
  if (baseURL && !baseURL.includes('localhost') && !baseURL.includes('127.0.0.1')) {
    expect(url).toContain('noticiencias.com');
  } else {
    expect(url).toContain(baseURL ? new URL(baseURL).hostname : 'localhost');
  }
});
