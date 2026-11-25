/**
 * Search page E2E tests.
 * Verifies the search index loads and the search interface works.
 */

import { test, expect, type Page } from './fixtures';

const SEARCH_REGRESSION_CASES = [
  [
    'teghaza 001',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'isótopos de oxígeno corales',
    '/ciencia/2026-08-27-los-corales-de-galapagos-ocultan-un-secreto-de-el-nino/',
  ],
  [
    'circónes',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'manto heterogéneo',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'pérdida atmosférica temprana Marte',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'neandertal herido cuidado',
    '/arqueologia/2026-10-17-neandertal-herido-y-cuidado-senal-de-empatia-hace-75-000-anos/',
  ],
  [
    'malaria glóbulo rojo',
    '/ciencia/2026-10-23-como-el-parasito-de-la-malaria-atraviesa-el-globulo-rojo-sin-romperlo/',
  ],
  [
    'hongos carbono CO2 toneladas',
    '/ciencia/2026-10-15-los-hongos-bajo-tus-pies-absorben-13-000-millones-de-toneladas-de-co2-anuales/',
  ],
  [
    'Rubin cámara planeta enano',
    '/astronomia/2026-10-28-rubin-estrena-su-camara-y-ya-encuentra-un-candidato-a-planeta-enano/',
  ],
  [
    'parásito malaria atraviesa eritrocito',
    '/ciencia/2026-10-23-como-el-parasito-de-la-malaria-atraviesa-el-globulo-rojo-sin-romperlo/',
  ],
  [
    'proteasas IA proteínas',
    '/tecnologia/2026-10-14-ia-crea-proteasas-desde-cero-conservando-solo-el-nucleo-catalitico/',
  ],
  [
    'glucosa sensor privacidad',
    '/tecnologia/2026-08-26-por-que-tu-sensor-de-glucosa-podria-estar-revelando-mas-de-lo-que-crees/',
  ],
  [
    'automatización salarios productividad',
    '/tecnologia/2026-05-07-el-mit-descubre-que-la-automatizacion-no-mejora-la-productividad-como-se-creia/',
  ],
  [
    'grafeno Edison 1879',
    '/ciencia/2026-01-24-thomas-edison-podria-haber-creado-el-grafeno-accidentalmente-en-1879/',
  ],
  [
    'Artemis comunicación láser',
    '/tecnologia/2026-04-02-comunicacion-laser-como-desbloqueara-datos-gigantes-y-video-hd-para-las-misiones-lunares-tripuladas/',
  ],
  [
    'nube marciana 1600 km',
    '/tecnologia/2026-10-24-un-modelo-explica-una-nube-marciana-de-1-600-km-con-fisica-teorica-nunca-observada/',
  ],
  [
    'tortuga ADN especies extintas',
    '/biologia/2026-08-26-que-revelo-el-adn-de-una-tortuga-que-el-tiempo-habia-borrado/',
  ],
  [
    'océanos Marte agua líquida',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'contaminación plomo salud infantil',
    '/arqueologia/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos/',
  ],
  ['bienvenidos a Noticiencias ciencia al alcance de todos', '/editorial/2026-02-12-bienvenidos/'],
] as const;

// Trailing-slash investigation concluded 2026-08-11 (plan 031): production
// serves the slash form as canonical (301s no-slash routes, 200 on the
// slash form), and config.yaml now sets trailingSlash: true so the local
// build matches the deployed site. Previously the local build 404'd on
// `/buscar/` while production served 200 — stale config, now fixed.
test('search page loads with input field', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);

  // The page's search input (not the header's, which is collapsed on
  // mobile viewports).
  const searchInput = page.locator('#search-box');
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeEnabled();
  const brokenImages = await page
    .locator('img')
    .evaluateAll((images) =>
      images
        .filter(
          (image) => image instanceof HTMLImageElement && image.complete && !image.naturalWidth
        )
        .map((image) => image.getAttribute('src'))
    );
  expect(brokenImages).toEqual([]);
  expect(errors).toEqual([]);
});

test('search index JSON is accessible', async ({ page }) => {
  const response = await page.request.get('/search.json');
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  // Plan 039: the artifact is now a versioned object { version, index, store }
  // instead of a top-level array of documents.
  expect(data).toBeTruthy();
  expect(data.version).toBe(3);
  expect(data.index).toBeTruthy();
  expect(data.index.serializationVersion).toBe(2);
  expect(data.index.documentCount).toBe(Object.keys(data.store).length);
  expect(data.store).toBeTruthy();
  const storeEntries = Object.keys(data.store);
  expect(storeEntries.length).toBeGreaterThan(0);
});

test('search finds a term near the end of the latest article body', async ({ page }) => {
  await page.goto('/buscar/');

  const input = page.locator('#search-box');
  await expect(input).toBeEnabled();
  await input.fill('grano circón datamos');
  await page.locator('#search-form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await expect(
    page.locator('#search-results a[data-analytics-search-result]').first()
  ).toHaveAttribute(
    'href',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/'
  );
});

test('search preserves the expected top result for the Spanish regression corpus', async ({
  page,
}) => {
  await page.goto('/buscar/');
  const input = page.locator('#search-box');
  const form = page.locator('#search-form');
  await expect(input).toBeEnabled();

  for (const [query, expectedUrl] of SEARCH_REGRESSION_CASES) {
    await input.fill(query);
    await form.evaluate((element) => {
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect(
      page.locator('#search-results a[data-analytics-search-result]').first(),
      `unexpected first result for query: ${query}`
    ).toHaveAttribute('href', expectedUrl);
  }
});

test('RSS feed is accessible', async ({ page }) => {
  const response = await page.request.get('/rss.xml');
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text).toContain('<rss');
  expect(text).toContain('<channel>');
  expect(text).toContain('<title>Noticiencias</title>');
});

test('LLMs.txt is accessible', async ({ page }) => {
  const response = await page.request.get('/llms.txt');
  expect(response.ok()).toBeTruthy();

  const text = await response.text();
  expect(text.length).toBeGreaterThan(0);
});

test.describe('header search', () => {
  const indexRequest = '**/search.json?*';
  const dialogSelector = '[data-search-dialog]';
  const inputSelector = '[data-search-input]';
  const resultSelector = '[data-search-results-list] a';
  const [firstQuery, firstResult] = SEARCH_REGRESSION_CASES[0];
  const [latestQuery, latestResult] = SEARCH_REGRESSION_CASES[1];

  async function openHeaderSearch(page: Page) {
    const trigger = page.locator('[data-search-trigger]');
    if (await trigger.isVisible()) await trigger.click();
    else await page.keyboard.press('/');
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('runs the latest query after the lazy index arrives', async ({ page }) => {
    const { promise: gate, resolve: release } = Promise.withResolvers<void>();
    await page.route(indexRequest, async (route) => {
      await gate;
      await route.continue();
    });
    const requested = page.waitForRequest(indexRequest);
    await openHeaderSearch(page);
    await requested;

    const dialog = page.locator(dialogSelector);
    const input = dialog.locator(inputSelector);
    await expect(input).toBeFocused();
    await input.fill(firstQuery);
    await input.fill(latestQuery);
    await expect(dialog.getByRole('status')).toHaveText('Cargando índice de búsqueda...');
    await expect(dialog.locator(resultSelector)).toHaveCount(0);

    release();
    await expect(dialog.locator(resultSelector).first()).toHaveAttribute('href', latestResult);
    await expect(dialog.locator('[data-search-all]')).toHaveAttribute(
      'href',
      `/buscar/?q=${encodeURIComponent(latestQuery)}`
    );

    await input.clear();
    await expect(dialog.locator('[data-search-recent] a').first()).toBeVisible();
    await expect(dialog.locator('[data-search-all]')).toHaveAttribute('href', '/buscar/');
  });

  test('retries a failed index load when reopened', async ({ page }) => {
    await page.route(indexRequest, (route) => route.fulfill({ status: 503 }), { times: 1 });
    const trigger = page.locator('[data-search-trigger]');
    const dialog = page.locator(dialogSelector);
    await openHeaderSearch(page);
    await expect(dialog.getByRole('status')).toHaveText('Error al cargar el buscador.');
    await dialog.locator(inputSelector).press('Escape');
    await expect(dialog).toBeHidden();
    if (await trigger.isVisible()) await expect(trigger).toBeFocused();

    await openHeaderSearch(page);
    await dialog.locator(inputSelector).fill(firstQuery);
    await expect(dialog.locator(resultSelector).first()).toHaveAttribute('href', firstResult);
  });

  test('keeps Enter native on the close button and follows an active suggestion from the input', async ({
    page,
  }) => {
    const dialog = page.locator(dialogSelector);
    const input = dialog.locator(inputSelector);
    const result = dialog.locator(resultSelector).first();

    await openHeaderSearch(page);
    await input.fill(firstQuery);
    await expect(result).toHaveAttribute('href', firstResult);
    await input.press('ArrowDown');
    await expect(result).toHaveClass(/\bis-active\b/);
    await dialog.getByRole('button', { name: 'Cerrar búsqueda' }).press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/');

    await openHeaderSearch(page);
    await input.fill(firstQuery);
    await expect(result).toHaveAttribute('href', firstResult);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(firstResult);
  });

  for (const method of ['input', 'all results link'] as const) {
    test(`opens the full search from the ${method}`, async ({ page }) => {
      const dialog = page.locator(dialogSelector);
      const input = dialog.locator(inputSelector);
      await openHeaderSearch(page);
      await input.press('Enter');
      await expect(dialog).toBeVisible();
      await input.fill(latestQuery);
      await expect(dialog.locator(resultSelector).first()).toHaveAttribute('href', latestResult);

      if (method === 'input') {
        await input.press('Enter');
      } else {
        await input.press('ArrowDown');
        await dialog.locator('[data-search-all]').press('Enter');
      }

      const fullSearch = page.locator('#search-box');
      await expect(fullSearch).toHaveValue(latestQuery);
      await expect(page.locator(`#search-results a[href="${latestResult}"]`).first()).toBeVisible();
      await expect(page).toHaveURL('/buscar/');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://noticiencias.com/buscar/'
      );
    });
  }
});
