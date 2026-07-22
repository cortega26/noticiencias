import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper to fetch the first article URL from search index. Article routes
// are leaf pages (e.g. `/2026-01-15-some-slug`) with no trailing slash —
// appending one 404s them, matching this repo's `trailingSlash: false`.
async function getFirstArticleUrl(page: Page): Promise<string | null> {
  const response = await page.request.get('/search.json');
  expect(response.ok(), 'search.json must be reachable').toBe(true);
  const index = (await response.json()) as { url?: string }[];
  expect(index.length, 'a local build always has articles in the search index').toBeGreaterThan(0);
  return index[0].url ?? null;
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

  // FIXME (plan 031, unresolved as of 2026-07-22): production serves these
  // routes with a trailing slash as canonical (200) and 301-redirects the
  // no-slash form, but this repo's `config.yaml` (`trailingSlash: false`)
  // makes the local build do the opposite — see navigation.test.ts for the
  // full finding. Asked the operator directly rather than guessing which
  // form is actually intended; don't "fix" these by picking one.
  test.fixme('blog archive page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/blog/');
  });

  test.fixme('search page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/buscar/');
  });

  test.fixme('report problem page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/reportar-problema/');
  });

  test.fixme('newsletter page has no a11y violations', async ({ page }) => {
    await checkA11y(page, '/newsletter/');
  });

  test('article page has no a11y violations', async ({ page }) => {
    const articleUrl = await getFirstArticleUrl(page);
    await checkA11y(page, articleUrl as string);
  });
});
