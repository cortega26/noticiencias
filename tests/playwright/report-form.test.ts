/**
 * Report form E2E tests.
 * Tests the problem reporting form on the reportar-problema page.
 */

import { test, expect, type Page } from './fixtures';

// Same-origin path — the page's CSP (connect-src 'self') would block fetch()
// to an external test domain, same as it would in production for anything
// not actually served from noticiencias.com.
const TEST_ENDPOINT = '/api/report';

/** Set the test-only endpoint override before the page's own scripts run. */
async function useTestEndpoint(page: Page) {
  await page.addInitScript((endpoint) => {
    (window as unknown as Record<string, string>).__NOTICIENCIAS_TEST_REPORT_ENDPOINT__ = endpoint;
  }, TEST_ENDPOINT);
}

/** Fill and submit the form via the simplest valid path (technical_site). */
async function fillAndSubmit(page: Page) {
  await page.selectOption('#problem-type', 'technical_site');
  await page.fill('#report-url', 'https://noticiencias.com/articulo-de-prueba');
  await page.fill('#report-description', 'El botón de compartir no responde en móvil.');
  await page.click('#submit-btn');
}

test('report form page loads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto('/reportar-problema/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#report-problem-form')).toHaveAttribute('data-bound', 'true');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://noticiencias.com/reportar-problema/'
  );
  const brokenImages = await page
    .locator('img')
    .evaluateAll((images) =>
      images
        .filter(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0
        )
        .map((image) => image.getAttribute('src'))
    );
  expect(brokenImages).toEqual([]);
  expect(errors).toEqual([]);
});

test('report form has problem type selector', async ({ page }) => {
  await page.goto('/reportar-problema/');

  const select = page.locator('select#problem-type');
  await expect(select).toBeVisible();
  const options = select.locator('option');
  const count = await options.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('report form validates required fields', async ({ page }) => {
  await page.goto('/reportar-problema/');

  const form = page.locator('form#report-problem-form');
  await expect(form).toBeAttached();

  const submitBtn = form.locator('button[type="submit"]');
  await expect(submitBtn).toBeVisible();
  const isDisabled = await submitBtn.isDisabled();
  expect(isDisabled || (await submitBtn.getAttribute('disabled')) !== null).toBeTruthy();
});

test('report form has accessible labels', async ({ page }) => {
  await page.goto('/reportar-problema/');

  const form = page.locator('form#report-problem-form');
  await expect(form).toBeAttached();

  const labels = form.locator('label');
  const labelCount = await labels.count();
  expect(labelCount).toBeGreaterThan(0);

  for (let i = 0; i < labelCount; i++) {
    const labelFor = await labels.nth(i).getAttribute('for');
    if (labelFor) {
      const target = page.locator(`#${labelFor}`);
      await expect(target).toBeAttached();
    }
  }
});

test('with no endpoint configured, the form is honestly disabled — never fakes success', async ({
  page,
}) => {
  // Force the empty-endpoint state explicitly (the test override takes
  // precedence over the config endpoint, which is now set in production —
  // plan 023, 2026-08-11). The plan's core bug was showing fake success
  // when no endpoint exists, so this state must stay tested even though
  // production now has a real endpoint.
  await page.addInitScript(() => {
    (window as unknown as Record<string, string>).__NOTICIENCIAS_TEST_REPORT_ENDPOINT__ = '';
  });
  await page.goto('/reportar-problema/');

  const form = page.locator('form#report-problem-form');

  await expect(form.locator('#submit-btn')).toBeDisabled();
  await expect(form.locator('#form-error')).toContainText('no está disponible');
  await expect(page.locator('#success-view')).toBeHidden();
});

test('a successful submission shows success only after a 2xx response with a report id', async ({
  page,
}) => {
  const form = page.locator('form#report-problem-form');
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'abc-123', message: 'ok' }),
    })
  );
  await page.goto('/reportar-problema/');

  await fillAndSubmit(page);

  await expect(page.locator('#success-view')).toBeVisible();
  await expect(page.locator('#report-receipt-id')).toHaveText('abc-123');
  await expect(form).toBeHidden();
});

test('requires the shared URL and a nonblank description before sending', async ({ page }) => {
  let requestCount = 0;
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => {
    requestCount += 1;
    return route.fulfill({ status: 201, json: { id: 'abc-123' } });
  });
  await page.goto('/reportar-problema/');
  await page.selectOption('#problem-type', 'technical_site');

  const description = page.locator('#report-description');
  const url = page.locator('#report-url');
  const submit = page.locator('#submit-btn');
  const error = page.locator('#form-error');

  for (const [articleUrl, descriptionText] of [
    ['', 'Falla del sitio'],
    ['https://noticiencias.com/prueba', ''],
    ['https://noticiencias.com/prueba', '   '],
  ]) {
    await url.fill(articleUrl);
    await description.fill(descriptionText);
    await submit.click();
    await expect(error).toContainText('campos obligatorios');
  }

  await description.fill('Falla del sitio');
  await submit.click();
  await expect(page.locator('#report-receipt-id')).toHaveText('abc-123');
  expect(requestCount).toBe(1);
});

test('retains drafts and omits inactive content fields from a technical report', async ({
  page,
}) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) =>
    route.fulfill({ status: 201, json: { id: 'technical-receipt' } })
  );
  await page.goto('/reportar-problema/');
  const type = page.locator('#problem-type');
  const snippet = page.locator('#content-snippet');
  const evidence = page.locator('#content-evidence');
  const browser = page.locator('#tech-browser');
  const submit = page.locator('#submit-btn');

  await type.selectOption('content_factual');
  await page.fill('#report-url', 'https://noticiencias.com/prueba');
  await page.fill('#report-description', 'Detalles del reporte');
  await evidence.fill('https://example.org/fuente');
  await snippet.fill('   ');
  await submit.click();
  await expect(page.locator('#form-error')).toContainText('campos obligatorios');
  await snippet.fill('Texto original');
  await evidence.fill('ftp://example.org/fuente');
  await submit.click();
  await expect(page.locator('#form-error')).toContainText('http/https');
  await type.selectOption('technical_site');
  await expect(evidence).toBeDisabled();
  await browser.fill('Firefox');
  await type.selectOption('content_factual');
  await expect(snippet).toHaveValue('Texto original');
  await expect(evidence).toHaveValue('ftp://example.org/fuente');
  await expect(browser).toBeDisabled();
  await type.selectOption('technical_site');
  await expect(browser).toHaveValue('Firefox');

  const submission = page.waitForRequest('**/api/report');
  await submit.click();
  await expect(page.locator('#report-receipt-id')).toHaveText('technical-receipt');
  expect((await submission).postDataJSON()).toEqual({
    problem_type: 'technical_site',
    article_url: 'https://noticiencias.com/prueba',
    description: 'Detalles del reporte',
    tech_browser: 'Firefox',
  });
});

test('omits inactive technical fields from a content report', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) =>
    route.fulfill({ status: 201, json: { id: 'editorial-receipt' } })
  );
  await page.goto('/reportar-problema/');
  const type = page.locator('#problem-type');
  await type.selectOption('technical_site');
  await page.fill('#tech-browser', 'Safari');
  await type.selectOption('content_factual');
  await page.fill('#report-url', 'https://noticiencias.com/prueba');
  await page.fill('#report-description', 'Detalles del reporte');
  await page.fill('#content-snippet', 'Texto original');
  await page.fill('#content-evidence', 'https://example.org/fuente');

  const submission = page.waitForRequest('**/api/report');
  await page.click('#submit-btn');
  await expect(page.locator('#report-receipt-id')).toHaveText('editorial-receipt');
  expect((await submission).postDataJSON()).toEqual({
    problem_type: 'content_factual',
    article_url: 'https://noticiencias.com/prueba',
    description: 'Detalles del reporte',
    content_snippet: 'Texto original',
    evidence_url: 'https://example.org/fuente',
  });
});

test('a successful HTTP response without a receipt leaves the form available', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => route.fulfill({ status: 201, json: { id: '   ' } }));
  await page.goto('/reportar-problema/');
  await fillAndSubmit(page);
  await expect(page.locator('#form-error')).toContainText('Ocurrió un error');
  await expect(page.locator('#submit-btn')).toBeEnabled();
  await expect(page.locator('#success-view')).toBeHidden();
});

test('a 422 response shows a validation error, not success', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Datos inválidos' }),
    })
  );
  await page.goto('/reportar-problema/');

  await fillAndSubmit(page);

  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#form-error')).toContainText('inválid');
  await expect(page.locator('#success-view')).toBeHidden();
});

test('a 429 response shows a rate-limit message, not success', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => route.fulfill({ status: 429 }));
  await page.goto('/reportar-problema/');

  await fillAndSubmit(page);

  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#form-error')).toContainText('Demasiados intentos');
  await expect(page.locator('#success-view')).toBeHidden();
});

test('a 503 response shows a service-unavailable message, not success', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => route.fulfill({ status: 503 }));
  await page.goto('/reportar-problema/');

  await fillAndSubmit(page);

  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#form-error')).toContainText('no está disponible');
  await expect(page.locator('#success-view')).toBeHidden();
});

test('a network failure shows a generic error, not success', async ({ page }) => {
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => route.abort('failed'));
  await page.goto('/reportar-problema/');

  await fillAndSubmit(page);

  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#success-view')).toBeHidden();
});

test('repeated ClientRouter page-load events do not attach duplicate submit listeners', async ({
  page,
}) => {
  let requestCount = 0;
  await useTestEndpoint(page);
  await page.route('**/api/report', (route) => {
    requestCount += 1;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'abc-123', message: 'ok' }),
    });
  });

  await page.goto('/reportar-problema/');

  await expect(page.locator('#report-problem-form')).toHaveAttribute('data-bound', 'true');
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));

  await fillAndSubmit(page);
  await expect(page.locator('#success-view')).toBeVisible();

  // A duplicated submit listener would fire the request twice for one click.
  expect(requestCount).toBe(1);
});
