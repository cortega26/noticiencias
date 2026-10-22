/** Newsletter stays unavailable until destination and confirmation flow are verified. */
import { test, expect } from './fixtures';

for (const route of ['/', '/newsletter/', '/categorias/ciencia/', '/temas/coral/']) {
  test(`${route} offers no unverified email subscription`, async ({ page }) => {
    const providerRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('buttondown.com')) providerRequests.push(request.url());
    });
    await page.goto(route);
    await expect(page.locator('form[data-newsletter-form]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('a[href="/newsletter/"]')).toHaveCount(0);
    expect(providerRequests).toEqual([]);
  });
}

test('RSS and archive fallback works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/newsletter/');
    await expect(page.locator('main')).toContainText(
      'Las suscripciones por correo están deshabilitadas'
    );
    await expect(page.getByRole('link', { name: 'Abrir canal RSS' })).toHaveAttribute(
      'href',
      '/rss.xml'
    );
    await page.getByRole('link', { name: 'Explorar el archivo' }).click();
    await expect(page).toHaveURL(/\/blog\/$/);
  } finally {
    await context.close();
  }
});
