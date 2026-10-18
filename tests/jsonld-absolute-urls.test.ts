import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const distDir = path.join(__dirname, '..', 'dist');

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

type JsonLd = { '@type'?: string; image?: unknown; itemListElement?: { item?: string }[] };

function schemas(file: string): JsonLd[] {
  const $ = load(fs.readFileSync(file, 'utf8'));
  return $('script[type="application/ld+json"]')
    .map((_, el) => {
      try {
        return JSON.parse($(el).html() ?? '{}') as JsonLd;
      } catch {
        return {};
      }
    })
    .get();
}

describe('structured data uses absolute URLs', () => {
  const pages = htmlFiles(distDir).map((file) => ({ file, schemas: schemas(file) }));
  const articles = pages.flatMap((page) =>
    page.schemas.filter((schema) => schema['@type'] === 'NewsArticle').map((a) => ({ ...page, a }))
  );

  it('finds the published articles', () => {
    expect(articles.length).toBeGreaterThan(40);
  });

  it('gives every NewsArticle at least one absolute https image', () => {
    for (const { file, a } of articles) {
      const images = Array.isArray(a.image) ? (a.image as string[]) : [];
      expect(images.length, file).toBeGreaterThan(0);
      for (const image of images) {
        expect(image, file).toMatch(/^https:\/\/noticiencias\.com\/_astro\//);
        expect(image, file).not.toContain('~/');
      }
    }
  });

  it('uses absolute item URLs in every BreadcrumbList', () => {
    const lists = pages.flatMap((page) =>
      page.schemas
        .filter((schema) => schema['@type'] === 'BreadcrumbList')
        .map((list) => ({ file: page.file, list }))
    );
    expect(lists.length).toBeGreaterThan(40);
    for (const { file, list } of lists) {
      for (const entry of list.itemListElement ?? []) {
        expect(entry.item, file).toMatch(/^https:\/\/noticiencias\.com\//);
      }
    }
  });
});
