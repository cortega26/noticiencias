import fs from 'node:fs';
import path from 'node:path';

import { load, type CheerioAPI } from 'cheerio';
import { expect } from 'vitest';

// Shared dist-HTML loader for article render assertions (Waves 1-4).
// Finds the built index.html whose path contains the given slug and returns
// the cheerio API. Fails explicitly when the article was not built.
const distDir = path.join(__dirname, '..', '..', 'dist');

export function loadDistArticle(slug: string): CheerioAPI {
  const candidates: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html' && full.includes(slug)) candidates.push(full);
    }
  };
  walk(distDir);
  expect(candidates, `No built HTML found for ${slug}`).not.toEqual([]);
  return load(fs.readFileSync(candidates[0], 'utf8'));
}
