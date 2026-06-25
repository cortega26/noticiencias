import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper to fetch the first article URL from search index
async function getFirstArticleUrl(page: Page): Promise<string | null> {
  try {
    const response = await page.request.get('/search.json');
    if (!response.ok()) return null;
    const index = (await response.json()) as any[];
    if (Array.isArray(index) && index.length > 0) {
      const url = index[0].url || index[0].permalink || index[0].href;
      // Ensure it has a trailing slash for local preview consistency
      return url ? (url.endsWith('/') ? url : `${url}/`) : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to check accessibility and format output
async function checkA11y(page: Page, path: string) {
  // Go to page
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);

  // Wait for content/hydration if needed
  await page.waitForLoadState('domcontentloaded');

  // Disable all transitions and animations to ensure colors are stable for contrast checks
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  // Scroll to the bottom of the page to trigger any intersection observers / lazy loading of footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // Small delay to let rendering engine repaint with stable styles
  await page.waitForTimeout(100);

  // Analyze page accessibility
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => ({
      html: n.html,
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  }));

  expect(
    violations,
    `Found accessibility violations on ${path}:\n${JSON.stringify(violations, null, 2)}`
  ).toHaveLength(0);
}

test.describe('Accessibility audits', () => {
  test('homepage has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/');
  });

  test('blog archive page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/blog/');
  });

  test('search page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/buscar/');
  });

  test('report problem page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/reportar-problema/');
  });

  test('newsletter page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/newsletter/');
  });

  test('article page has no a11y violations', async ({ page }) => {
    const articleUrl = await getFirstArticleUrl(page);
    if (!articleUrl) {
      test.skip(true, 'No article URL found');
      return;
    }
    // Convert url path to relative to baseURL
    const path = new URL(articleUrl, 'https://noticiencias.com').pathname;
    await checkA11y(page, path);
  });
});
