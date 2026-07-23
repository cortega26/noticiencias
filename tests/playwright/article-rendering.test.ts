/**
 * Article rendering tests.
 * Verifies structure, metadata, and accessibility of article pages.
 *
 * Runs against a local production build (see playwright.config.ts) where
 * `search.json` is always populated with real content — there is no
 * legitimate "no article found" case to skip past.
 */

import { test, expect, type Page } from '@playwright/test';

async function getFirstArticleUrl(page: Page): Promise<string> {
  const response = await page.request.get('/search.json');
  expect(response.ok(), 'search.json must be reachable for these tests to mean anything').toBe(
    true
  );
  // The search artifact is now a versioned object { version, index, store }
  // (plan 039) instead of a top-level array of documents.
  const artifact = (await response.json()) as {
    version?: number;
    store?: Record<string, { url?: string }>;
  };
  expect(artifact, 'search artifact must be an object').toBeTruthy();
  expect(artifact.version, 'search artifact must have a version').toBe(1);
  const store = artifact.store ?? {};
  const urls = Object.values(store)
    .map((e) => e.url)
    .filter(Boolean);
  expect(urls.length > 0, 'search store must contain at least one article').toBe(true);
  return urls[0] as string;
}

test('article page has hero heading', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  const response = await page.goto(articleUrl);
  expect(response?.status()).toBe(200);

  const h1 = page.locator('h1');
  await expect(h1.first()).toBeVisible();

  const title = await h1.first().textContent();
  expect(title?.trim().length).toBeGreaterThan(0);
});

test('article page has a hero image with real alt text', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  await page.goto(articleUrl);

  const image = page.locator('article img, main img').first();
  await expect(image).toBeVisible();

  const alt = await image.getAttribute('alt');
  const src = await image.getAttribute('src');
  expect(src).toBeTruthy();
  // An empty alt is a real accessibility failure, not an acceptable variant.
  expect(alt?.trim().length ?? 0).toBeGreaterThan(0);
});

test('article page has valid JSON-LD structured-data blocks', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  await page.goto(articleUrl);

  const ldJson = page.locator('script[type="application/ld+json"]');
  const count = await ldJson.count();
  expect(count, 'an article page must emit at least one JSON-LD block').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const text = await ldJson.nth(i).textContent();
    const parsed = JSON.parse(text || 'null');
    expect(parsed, `block ${i} must be valid, parseable JSON-LD`).not.toBeNull();
    expect(parsed['@context'], `block ${i} must declare a schema.org context`).toBe(
      'https://schema.org'
    );
  }
});

test('article page has OpenGraph meta tags', async ({ page }) => {
  const articleUrl = await getFirstArticleUrl(page);
  await page.goto(articleUrl);

  const ogTitle = page.locator('meta[property="og:title"]');
  await expect(ogTitle).toHaveCount(1);

  const content = await ogTitle.getAttribute('content');
  expect(content?.trim().length).toBeGreaterThan(0);
});
