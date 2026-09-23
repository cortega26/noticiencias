import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const distDir = path.join(__dirname, '..', 'dist');
const ARTICLE =
  '/arqueologia/2026-09-20-el-plomo-en-la-tinta-lee-los-rollos-del-vesubio-sin-abrirlos/';

function readDistHtml(route: string) {
  const htmlPath = path.join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  expect(fs.existsSync(htmlPath), `Built HTML missing for ${route}. Run npm run build.`).toBe(true);
  return fs.readFileSync(htmlPath, 'utf8');
}

function readBundledJs(): string {
  const dir = path.join(distDir, '_astro');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}

const FUNNEL_EVENTS = [
  'article_view',
  'article_50',
  'article_90',
  'primary_source_click',
  'outbound_source_click',
  'related_impression',
  'related_article_click',
  'newsletter_impression',
  'newsletter_start',
  'newsletter_submit',
  'newsletter_success',
  'newsletter_error',
  'series_click',
  'topic_click',
  'topic_follow_click',
  'category_click',
  'share_click',
  'search_result_click',
];

describe('GA4 funnel wiring (P2-03)', () => {
  it('marks the article body and keeps primary sources distinct from coverage', () => {
    const page = load(readDistHtml(ARTICLE));

    expect(page('[data-analytics-article]').length).toBe(1);
    expect(page('[data-analytics-primary-source]').length).toBeGreaterThan(0);
    page('[data-analytics-primary-source]').each((_, element) => {
      expect(page(element).attr('data-analytics-source')).toBeUndefined();
    });
  });

  it('marks the related block with the kind the ranking used', () => {
    const page = load(readDistHtml(ARTICLE));

    expect(page('[data-analytics-related]').attr('data-analytics-related')).toBe('related');
  });

  it('marks topic, series and newsletter hooks on the surfaces that render them', () => {
    const home = load(readDistHtml('/'));
    expect(home('[data-analytics-topic]').length).toBeGreaterThan(0);
    expect(home('[data-analytics-series]').length).toBeGreaterThan(0);

    const formIds = home('[data-newsletter-form-id]')
      .map((_, element) => home(element).attr('data-newsletter-form-id'))
      .get();
    expect(formIds).toEqual(['newsletter-hero', 'newsletter-final']);

    expect(load(readDistHtml('/series/'))('[data-analytics-series]').length).toBeGreaterThan(0);
  });

  it('ships the funnel event names and drops the retired ones', () => {
    const js = readBundledJs();

    for (const name of FUNNEL_EVENTS) {
      expect(js, name).toContain(name);
    }
    expect(js).not.toContain('newsletter_signup');
    expect(js).not.toContain('scroll_75');
  });
});
