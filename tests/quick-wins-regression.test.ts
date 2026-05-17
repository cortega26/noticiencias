import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const srcDir = path.join(repoRoot, 'src');

function readDistHtml(route: string) {
  const htmlPath = path.join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  expect(fs.existsSync(htmlPath), `Built HTML missing for ${route}. Run npm run build.`).toBe(true);
  return fs.readFileSync(htmlPath, 'utf8');
}

function collectFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(filePath, predicate);
    }
    return predicate(filePath) ? [filePath] : [];
  });
}

function getLatestMtimeMs(files: string[]) {
  return files.reduce((latest, filePath) => Math.max(latest, fs.statSync(filePath).mtimeMs), 0);
}

describe('quick wins regression coverage', () => {
  it('uses a fresh dist build for dist-backed assertions', () => {
    expect(fs.existsSync(distDir), 'Dist directory not found. Run npm run build first.').toBe(true);

    const sourceFiles = [
      ...collectFiles(srcDir, (filePath) =>
        /\.(astro|js|ts|md|mdx|yaml|json)$/.test(path.basename(filePath))
      ),
      path.join(repoRoot, 'astro.config.mjs'),
      path.join(repoRoot, 'data/image-derivatives-manifest.json'),
    ].filter((filePath) => fs.existsSync(filePath));

    const latestSourceMtime = getLatestMtimeMs(sourceFiles);
    const latestDistMtime = getLatestMtimeMs(collectFiles(distDir, () => true));

    expect(
      latestDistMtime,
      'Dist is older than source files. Run npm run build before npm run test:audit.'
    ).toBeGreaterThanOrEqual(latestSourceMtime);
  });

  it('emits page-specific metadata for pages that previously fell back to defaults', () => {
    const search = load(readDistHtml('/buscar/'));
    expect(search('title').text()).toBe('Buscar Noticias | Noticiencias');
    expect(search('meta[name="description"]').attr('content')).toBe(
      'Busca artículos de ciencia, tecnología e internet publicados por Noticiencias.'
    );

    const hypeDetector = load(readDistHtml('/recursos/detector-de-hype/'));
    expect(hypeDetector('title').text()).toBe('Detector de Hype: Guía Rápida | Noticiencias');
    expect(hypeDetector('meta[name="description"]').attr('content')).toBe(
      'Cómo leer noticias científicas y tecnológicas sin ser engañado.'
    );
  });

  it('keeps RSS item links on canonical permalink routes', () => {
    const rssPath = path.join(distDir, 'rss.xml');
    expect(fs.existsSync(rssPath), 'Built RSS feed missing. Run npm run build.').toBe(true);

    const rss = fs.readFileSync(rssPath, 'utf8');
    expect(rss).not.toContain('/posts/');
    expect(rss).toContain('https://noticiencias.com/ciencia/2026-01-18-article-64/');
  });

  it('keeps ds components independent from the frozen template layer', () => {
    const dsFiles = collectFiles(path.join(srcDir, 'components', 'ds'), (filePath) =>
      filePath.endsWith('.astro')
    );
    const violations = dsFiles.filter((filePath) =>
      fs.readFileSync(filePath, 'utf8').includes('components/template/')
    );

    expect(violations).toEqual([]);
  });

  it('keeps BaseLayout callers on the metadata prop path', () => {
    const files = collectFiles(srcDir, (filePath) => filePath.endsWith('.astro')).filter(
      (filePath) => !filePath.endsWith(path.join('layouts', 'BaseLayout.astro'))
    );

    const legacyCallers = files.filter((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return /<BaseLayout[^>]*\s(?:title|description|image)=/.test(source);
    });

    expect(legacyCallers).toEqual([]);
  });
});
