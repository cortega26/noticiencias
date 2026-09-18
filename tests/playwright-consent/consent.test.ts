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
