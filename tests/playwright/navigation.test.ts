/**
 * Basic site navigation tests.
 * Verifies key pages load and return 200 with correct structure.
 */

import { test, expect } from './fixtures';

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

test('home "De esta edición" always shows exactly six stories, none repeated from the lead', async ({
  page,
}) => {
  await page.goto('/');
  const edition = page.getByTestId('home-edition');
  await expect(edition.getByRole('heading', { name: 'De esta edición' })).toBeVisible();
  await expect(edition.locator('article')).toHaveCount(6);

  // Only story links: category/tag links legitimately repeat across cards.
  const storyHrefs = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => /^\/[^/]+\/\d{4}-\d{2}-\d{2}-/.test(href))
    );
  const leadHrefs = await storyHrefs(
    page.locator('[aria-label="Historia principal"] a[href^="/"]')
  );
  const editionHrefs = await storyHrefs(edition.locator('article a[href^="/"]'));
  expect(leadHrefs.length).toBeGreaterThan(0);
  expect(editionHrefs.length).toBeGreaterThan(0);
  for (const href of editionHrefs) expect(leadHrefs).not.toContain(href);
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
