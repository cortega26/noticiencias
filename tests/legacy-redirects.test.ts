import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const redirects = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'legacy-redirects.json'), 'utf8')
) as Record<string, string>;

const distHtml = (route: string) => path.join(root, 'dist', route, 'index.html');
const sitemap = fs.readFileSync(path.join(root, 'dist', 'sitemap-0.xml'), 'utf8');

describe('legacy URL redirects', () => {
  const entries = Object.entries(redirects);

  it('declares well-formed, non-self-referencing absolute paths with a trailing slash', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [source, target] of entries) {
      expect(source, source).toMatch(/^\/.+\/$/);
      expect(target, target).toMatch(/^\/.+\/$/);
      expect(source).not.toBe(target);
    }
  });

  it.each(entries)('%s emits an instant redirect to a real page', (source, target) => {
    const redirectPage = fs.readFileSync(distHtml(source), 'utf8');
    expect(redirectPage).toContain(`http-equiv="refresh" content="0;url=${target}"`);
    expect(redirectPage).toContain(`rel="canonical" href="https://noticiencias.com${target}"`);

    // The target must exist and be a final page (no chains, no unpublished post).
    expect(fs.existsSync(distHtml(target)), `${target} is not built`).toBe(true);
    expect(fs.readFileSync(distHtml(target), 'utf8')).not.toContain('http-equiv="refresh"');
  });

  it('keeps redirect sources out of the sitemap', () => {
    for (const source of Object.keys(redirects)) {
      expect(sitemap).not.toContain(`<loc>https://noticiencias.com${source}</loc>`);
    }
  });
});
