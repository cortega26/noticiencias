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

test('newsletter impression, start and submit fire on the home capture', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  await page.route('https://buttondown.com/**', (route) =>
    route.fulfill({
      status: 302,
      headers: { location: 'https://buttondown.com/subscribe/confirm' },
    })
  );

  await page.goto('/');
  const form = page.locator('section[aria-labelledby="home-newsletter-cta"] form');
  await form.scrollIntoViewIfNeeded();

  await expect.poll(() => eventNames(page)).toContain('newsletter_impression');

  await form.locator('input[type="email"]').fill('lector@example.com');
  await expect.poll(() => eventNames(page)).toContain('newsletter_start');

  await form.locator('button[type="submit"]').click();
  await expect.poll(() => eventNames(page)).toContain('newsletter_submit');

  const params = await page.evaluate(() =>
    window.__gaEvents.find((event) => event.name === 'newsletter_submit')
  );
  expect(params?.params).toMatchObject({ method: 'form_submit', form_id: 'newsletter-hero' });
});

test('topic and related clicks carry their slugs without navigation', async ({ page }) => {
  await page.addInitScript(captureDataLayer);
  // Keep the page in place so the captured dataLayer survives the assertion.
  await page.addInitScript(() => {
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
