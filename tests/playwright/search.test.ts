/**
 * Search page E2E tests.
 * Verifies the search index loads and the search interface works.
 */

import { test, expect } from './fixtures';

const SEARCH_REGRESSION_CASES = [
  [
    'teghaza 001',
    '/ciencia/2026-10-29-un-trozo-de-marte-en-el-sahara-supera-a-la-roca-terrestre-mas-antigua/',
  ],
  [
    'isótopos de hidrógeno',
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
  ['ciencia inteligencia artificial evidencia', '/editorial/2026-02-12-bienvenidos/'],
] as const;

// Trailing-slash investigation concluded 2026-08-11 (plan 031): production
// serves the slash form as canonical (301s no-slash routes, 200 on the
// slash form), and config.yaml now sets trailingSlash: true so the local
// build matches the deployed site. Previously the local build 404'd on
// `/buscar/` while production served 200 — stale config, now fixed.
test('search page loads with input field', async ({ page }) => {
  const response = await page.goto('/buscar/');
  expect(response?.status()).toBe(200);

  // The page's search input (not the header's, which is collapsed on
  // mobile viewports).
  const searchInput = page.locator('#search-box');
  await expect(searchInput).toBeVisible();
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
  await input.fill('certeza de saber');
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
