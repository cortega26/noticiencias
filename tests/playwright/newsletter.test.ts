/**
 * Native Buttondown form behavior. Every provider request is intercepted in
 * Playwright so these tests can verify the POST without creating subscribers.
 */
import { test, expect, type Page } from './fixtures';

const BUTTONDOWN_ENDPOINT = 'https://buttondown.com/api/emails/embed-subscribe/noticiencias';

async function captureProviderPost(page: Page) {
  let requestBody: string | null = null;
  await page.route(BUTTONDOWN_ENDPOINT, async (route) => {
    requestBody = route.request().postData();
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Buttondown response</title><p>Mock provider page</p>',
    });
  });
  return () => requestBody;
}

async function submitWithTestAddress(page: Page): Promise<void> {
  await page.goto('/newsletter/');
  const form = page.locator('form[aria-label="Suscripción al boletín"]').first();
  await form.locator('input[name="email"]').fill('newsletter-test@example.invalid');
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(BUTTONDOWN_ENDPOINT);
  await expect(page.locator('body')).toContainText('Mock provider page');
}

function expectProviderFormBody(body: string | null) {
  expect(body).toBeTruthy();
  expect(body).toContain('email=newsletter-test%40example.invalid');
  expect(body).toContain('embed=1');
}

test('with JavaScript enabled, submits the documented native Buttondown POST', async ({ page }) => {
  const getBody = await captureProviderPost(page);
  await submitWithTestAddress(page);
  expectProviderFormBody(getBody());
});

test('without JavaScript, submits the same documented form and parameters', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const getBody = await captureProviderPost(page);
    await submitWithTestAddress(page);
    expectProviderFormBody(getBody());
  } finally {
    await context.close();
  }
});

test('copy explains confirmation, provider, cadence, and unsubscribe without claiming success', async ({
  page,
}) => {
  await page.goto('/newsletter/');
  const form = page.locator('form[aria-label="Suscripción al boletín"]').first();
  await expect(form.locator('input[name="embed"]')).toHaveValue('1');
  await expect(form).toContainText('Buttondown');
  await expect(form).toContainText('confirmar por correo');
  await expect(form).toContainText('no hay una frecuencia garantizada');
  await expect(form).toContainText('darte de baja');
  await expect(form).not.toContainText('Revisa tu correo para confirmar tu suscripción');
});
