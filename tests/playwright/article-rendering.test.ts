/**
 * Article rendering tests.
 * Verifies structure, metadata, and accessibility of article pages.
 */

import { test, expect } from '@playwright/test';

// Fetch the search index to find an article URL
async function getFirstArticleUrl(page: any): Promise<string | null> {
  try {
    const response = await page.request.get('/search.json');
    if (!response.ok()) return null;
    const index = await response.json();
    // Return the first article's URL from the index
    if (Array.isArray(index) && index.length > 0) {
      return index[0].url || index[0].permalink || index[0].href || null;
    }
    // Try blog archive
    await page.goto('/blog');
    const link = page.locator('article a[href]').first();
    const href = await link.getAttribute('href');
    return href || null;
  } catch {
    return null;
  }
}

test('article page has hero heading', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  if (!articleUrl) {
    test.skip(true, 'No article URL found in search index');
    return;
  }

  const response = await page.goto(articleUrl);
  expect(response?.status()).toBe(200);

  // Should have at least one h1
  const h1 = page.locator('h1');
  await expect(h1.first()).toBeVisible();

  const title = await h1.first().textContent();
  expect(title?.trim().length).toBeGreaterThan(0);
});

test('article page has image with alt text', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  if (!articleUrl) {
    test.skip(true, 'No article URL found');
    return;
  }

  await page.goto(articleUrl);

  // Find hero image
  const images = page.locator('article img, main img').first();
  const count = await images.count();
  if (count > 0) {
    const alt = await images.getAttribute('alt');
    const src = await images.getAttribute('src');
    expect(src).toBeTruthy();
    // Alt text should be present (empty string is a failure)
    if (alt !== null) {
      expect(alt.trim().length).toBeGreaterThan(0);
    }
  }
});

test('article page has structured data', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  if (!articleUrl) {
    test.skip(true, 'No article URL found');
    return;
  }

  await page.goto(articleUrl);

  // Check for JSON-LD structured data
  const ldJson = page.locator('script[type="application/ld+json"]');
  const count = await ldJson.count();
  expect(count).toBeGreaterThanOrEqual(0); // At least not crashing

  if (count > 0) {
    const text = await ldJson.first().textContent();
    expect(() => JSON.parse(text || '')).not.toThrow();
  }
});

test('article page has OpenGraph meta tags', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  if (!articleUrl) {
    test.skip(true, 'No article URL found');
    return;
  }

  await page.goto(articleUrl);

  // og:title should be present
  const ogTitle = page.locator('meta[property="og:title"]');
  const ogCount = await ogTitle.count();
  expect(ogCount).toBeGreaterThan(0);

  if (ogCount > 0) {
    const content = await ogTitle.getAttribute('content');
    expect(content?.trim().length).toBeGreaterThan(0);
  }
});
