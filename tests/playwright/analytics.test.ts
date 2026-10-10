/**
 * GA4 funnel events in a real browser (P2-03).
 *
 * The shared fixture stubs the analytics hosts and denies consent, so this
 * suite captures `dataLayer` pushes instead of loading gtag.js: the consent
 * bootstrap defines `gtag` as `dataLayer.push(arguments)`, so wrapping the
 * array's push sees exactly what would be sent.
 */
import { test, expect, type Page } from './fixtures';

declare global {
  interface Window {
    dataLayer?: ArrayLike<unknown>[];
    __gaEvents: Array<{ name: string; params: Record<string, unknown> }>;
  }
}

function captureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  window.__gaEvents = [];
  const originalPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = (...args) => {
    for (const arg of args) {
      if (arg && arg[0] === 'event') {
        window.__gaEvents.push({ name: String(arg[1]), params: arg[2] as Record<string, unknown> });
      }
    }
    return originalPush(...args);
  };
}

async function eventNames(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__gaEvents.map((event) => event.name));
}

const ARTICLE =
  '/arqueologia/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos/';

test('article view and read depth fire on an article page', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await page.goto(ARTICLE);

  await expect.poll(() => eventNames(page)).toContain('article_view');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => eventNames(page)).toContain('article_90');
  await expect.poll(() => eventNames(page)).toContain('related_impression');

  const events = await eventNames(page);
  expect(events).toContain('article_50');
  expect(events.filter((name) => name === 'article_view')).toHaveLength(1);
});

test('newsletter submit records intent only, not provider acceptance or confirmation', async ({
  page,
}) => {
  await page.addInitScript(captureDataLayer);

  await page.goto('/');
  const form = page.locator('section[aria-labelledby="home-newsletter-cta"] form');
  await form.scrollIntoViewIfNeeded();

  await expect.poll(() => eventNames(page)).toContain('newsletter_impression');

  await form.locator('input[type="email"]').fill('lector@example.com');
  await expect.poll(() => eventNames(page)).toContain('newsletter_start');

  // A synthetic submit emits the site-owned intent event without sending a
  // registration request to Buttondown or implying provider acceptance.
  await form.evaluate((element) =>
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  );
  await expect.poll(() => eventNames(page)).toContain('newsletter_submit');
  const events = await eventNames(page);
  expect(events).not.toContain('newsletter_success');
  expect(events).not.toContain('newsletter_error');

  const params = await page.evaluate(() =>
    window.__gaEvents.find((event) => event.name === 'newsletter_submit')
  );
  expect(params?.params).toMatchObject({ method: 'form_submit', form_id: 'newsletter-hero' });
});

function preventNavigations(page: Page) {
  return page.addInitScript(() => {
    document.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('a[href]')) {
          event.preventDefault();
        }
      },
      true
    );
  });
}

test('topic and related clicks carry their slugs without navigation', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await preventNavigations(page);

  await page.goto(ARTICLE);
  await page.locator('[data-analytics-topic]').first().click();
  await page.locator('[data-analytics-related] a[href]').first().click();
  await page.locator('[data-analytics-primary-source]').first().click();

  const events = await page.evaluate(() => window.__gaEvents);
  expect(events.some((event) => event.name === 'topic_click')).toBe(true);
  expect(events.some((event) => event.name === 'related_article_click')).toBe(true);
  expect(events.some((event) => event.name === 'primary_source_click')).toBe(true);

  const related = events.find((event) => event.name === 'related_article_click');
  expect(related?.params).toMatchObject({ related_kind: 'related' });

  const primary = events.find((event) => event.name === 'primary_source_click');
  expect(primary?.params).toMatchObject({ article_path: ARTICLE });
});

test('category and share clicks are attributed on an article', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await preventNavigations(page);

  await page.goto(ARTICLE);
  await page.locator('[data-analytics-category]').first().click();
  await page.locator('[data-aw-social-share]').first().click();

  const events = await page.evaluate(() => window.__gaEvents);
  const category = events.find((event) => event.name === 'category_click');
  expect(category?.params).toMatchObject({ category_slug: 'arqueologia' });

  const share = events.find((event) => event.name === 'share_click');
  expect(share?.params).toMatchObject({ network: 'twitter', article_path: ARTICLE });
});

test('topic follow clicks are attributed on a hub', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await preventNavigations(page);

  await page.goto('/temas/coral/');
  await page.locator('[data-analytics-topic-follow]').first().click();

  await expect.poll(() => eventNames(page)).toContain('topic_follow_click');
  const events = await page.evaluate(() => window.__gaEvents);
  const follow = events.find((event) => event.name === 'topic_follow_click');
  expect(follow?.params).toMatchObject({ topic_slug: 'coral' });
});

test('search result clicks contain only safe path and position', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await preventNavigations(page);

  await page.goto('/buscar/?q=ciencia');
  const firstResult = page.locator('[data-analytics-search-result]').first();
  await expect(firstResult).toBeVisible();
  await firstResult.click();

  await expect.poll(() => eventNames(page)).toContain('search_result_click');
  const events = await page.evaluate(() => window.__gaEvents);
  const result = events.find((event) => event.name === 'search_result_click');
  expect(result?.params).toMatchObject({ position: 0 });
  expect(result?.params).not.toHaveProperty('search_term');
  expect(await page.evaluate(() => window.location.search)).toBe('');
});

test('inbound search query is usable but absent from GA payloads and browser URL', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  const privateTerm = 'lector.privado@example.com';
  await page.goto('/buscar/?q=' + encodeURIComponent(privateTerm));

  await expect(page.locator('#search-box')).toHaveValue(privateTerm);
  await expect.poll(() => eventNames(page)).toContain('search');
  expect(await page.evaluate(() => window.location.search)).toBe('');

  const dataLayer = await page.evaluate(() => JSON.stringify(window.dataLayer));
  expect(dataLayer).not.toContain(privateTerm);
  const search = await page.evaluate(() =>
    window.__gaEvents.find((event) => event.name === 'search')
  );
  expect(search?.params).toHaveProperty('results_count');
  expect(search?.params).not.toHaveProperty('search_term');
});
