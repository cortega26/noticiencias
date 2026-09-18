import { expect, test, type Page } from '@playwright/test';

// Plan 009. gtag.js is stubbed so the suite is hermetic: it asserts what the page
// *asks* Google to do (the dataLayer), which is where Consent Mode ordering lives.
// Cookie behaviour (`_ga` absent before consent) needs the real gtag.js and is a
// post-deploy check, recorded in plans/009.
const stubGoogle = (page: Page) =>
  page.route(/googletagmanager\.com|google-analytics\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
  );

const dataLayer = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer: IArguments[] }).dataLayer ?? []).map((e) => Array.from(e))
  );

const banner = (page: Page) => page.locator('#consent-banner');

test.beforeEach(async ({ page }) => {
  await stubGoogle(page);
});

test('first visit: banner is shown and consent starts fully denied, before config', async ({
  page,
}) => {
  await page.goto('/');
  await expect(banner(page)).toBeVisible();

  const layer = await dataLayer(page);
  expect(layer[0]).toEqual([
    'consent',
    'default',
    {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
  ]);
  expect(layer.map((e) => e[0])).toEqual(['consent', 'js', 'config']);
});

test('accept and reject are equally prominent controls', async ({ page }) => {
  await page.goto('/');
  const accept = banner(page).getByRole('button', { name: 'Aceptar' });
  const reject = banner(page).getByRole('button', { name: 'Rechazar' });
  const [a, r] = await Promise.all([accept.boundingBox(), reject.boundingBox()]);
  expect(a && r).toBeTruthy();
  expect(Math.abs(a!.height - r!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(a!.width - r!.width)).toBeLessThanOrEqual(12);
  expect(await accept.evaluate((el) => el.className)).toBe(
    await reject.evaluate((el) => el.className)
  );
});

test('accepting sends a consent update, hides the banner and survives a reload', async ({
  page,
}) => {
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner(page)).toBeHidden();

  const updates = (await dataLayer(page)).filter((e) => e[0] === 'consent' && e[1] === 'update');
  expect(updates).toEqual([['consent', 'update', { analytics_storage: 'granted' }]]);

  await page.reload();
  await expect(banner(page)).toBeHidden();
  // The stored grant is applied in <head>, before config — never after.
  const order = (await dataLayer(page)).map((e) => e[0] + (e[1] === 'update' ? ':update' : ''));
  expect(order.indexOf('consent:update')).toBeLessThan(order.indexOf('config'));
});

test('rejecting is remembered and never grants', async ({ page }) => {
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Rechazar' }).click();
  await expect(banner(page)).toBeHidden();
  await page.reload();
  await expect(banner(page)).toBeHidden();
  const layer = await dataLayer(page);
  expect(layer.some((e) => e[0] === 'consent' && e[1] === 'update')).toBe(false);
});

test('the footer link reopens the banner so the choice can be changed', async ({ page }) => {
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner(page)).toBeHidden();

  await page.getByRole('button', { name: 'Preferencias de privacidad' }).click();
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole('button', { name: 'Rechazar' }).click();

  const updates = (await dataLayer(page))
    .filter((e) => e[0] === 'consent' && e[1] === 'update')
    .map((e) => (e[2] as { analytics_storage: string }).analytics_storage);
  expect(updates).toEqual(['granted', 'denied']);
});

test('ClientRouter navigation: banner re-evaluates and listeners are not duplicated', async ({
  page,
}) => {
  await page.goto('/');
  // Move across several soft navigations without a full reload.
  for (const path of ['/blog/', '/nosotros/', '/blog/']) {
    await page.evaluate((href) => {
      const link = document.createElement('a');
      link.href = href;
      document.body.appendChild(link);
      link.click();
    }, path);
    await page.waitForURL(`**${path}`);
  }
  // Banner is fresh DOM after each swap and must show again while undecided.
  await expect(banner(page)).toBeVisible();

  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner(page)).toBeHidden();

  // A duplicated delegated listener would have queued more than one update.
  const updates = (await dataLayer(page)).filter((e) => e[0] === 'consent' && e[1] === 'update');
  expect(updates).toHaveLength(1);

  // And the decision holds across the next soft navigation.
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/nosotros/';
    document.body.appendChild(link);
    link.click();
  });
  await page.waitForURL('**/nosotros/');
  await expect(banner(page)).toBeHidden();
});

// ---- Phase 3: custom events -------------------------------------------------
// gtag.js is stubbed, but the bootstrap defines `window.gtag`, so these assert the
// `event` entries the page queues on the dataLayer.
const events = async (page: Page, name: string) =>
  (await dataLayer(page)).filter((e) => e[0] === 'event' && e[1] === name).map((e) => e[2]);

const stubExternal = (page: Page) =>
  page.route(/^https:\/\/(?!(www\.)?(googletagmanager|google-analytics))[^/]+\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' })
  );

// Fixed article known to render a sources list (TrustPanel) and the scroll hook.
const ARTICLE =
  '/ciencia/2026-01-24-thomas-edison-podria-haber-creado-el-grafeno-accidentalmente-en-1879/';

test('newsletter submit queues one newsletter_signup event', async ({ page }) => {
  await page.goto('/newsletter/');
  // Cancel the real POST to Buttondown; the delegated tracker still sees the submit.
  await page.locator('form[data-analytics-newsletter]').evaluate((form) => {
    form.addEventListener('submit', (e) => e.preventDefault());
  });
  await page.getByLabel('Correo electrónico').fill('lector@example.com');
  await page.getByRole('button', { name: 'Suscribirme' }).click();
  expect(await events(page, 'newsletter_signup')).toEqual([
    { transport_type: 'beacon', method: 'form_submit' },
  ]);
});

test('search sends a `search` event with the term and result count', async ({ page }) => {
  await page.goto('/buscar/?q=ciencia');
  await expect
    .poll(async () => (await events(page, 'search')).length, { timeout: 8000 })
    .toBeGreaterThan(0);
  const [first] = await events(page, 'search');
  expect(first).toMatchObject({ search_term: 'ciencia', transport_type: 'beacon' });
  expect(typeof (first as { results_count: number }).results_count).toBe('number');
});

test('an external source link queues outbound_source_click with its domain', async ({ page }) => {
  await stubExternal(page);
  await page.goto(ARTICLE);
  const source = page.locator('a[data-analytics-source]').first();
  await expect(source).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent('popup'), source.click()]);
  await popup.close();
  const [event] = await events(page, 'outbound_source_click');
  expect(event).toMatchObject({ transport_type: 'beacon' });
  expect((event as { link_domain: string }).link_domain).not.toContain('noticiencias');
});

test('scroll_75 fires once after reading three quarters of an article, not on load', async ({
  page,
}) => {
  await page.goto(ARTICLE);
  await expect(page.locator('[data-analytics-scroll]')).toBeAttached();
  expect(await events(page, 'scroll_75')).toHaveLength(0);

  const box = await page.locator('[data-analytics-scroll]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height };
  });
  const viewport = page.viewportSize()!.height;
  // Put the 80% mark of the article at the bottom edge of the viewport.
  await page.evaluate((y) => window.scrollTo(0, y), box.top + box.height * 0.8 - viewport);
  await expect
    .poll(async () => (await events(page, 'scroll_75')).length, { timeout: 5000 })
    .toBe(1);

  // Scrolling further must not fire it again.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  expect(await events(page, 'scroll_75')).toHaveLength(1);
});
