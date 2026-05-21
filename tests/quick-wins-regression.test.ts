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
    expect(hypeDetector('title').text()).toBe(
      'Detector de Hype: Guía de Sobrevivencia | Noticiencias'
    );
    expect(hypeDetector('meta[name="description"]').attr('content')).toBe(
      'Una caja de herramientas mental para distinguir la ciencia real de las promesas de marketing y el clickbait.'
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

  it('keeps BaseLayout itself narrowed to metadata and frontmatter', () => {
    const source = fs.readFileSync(path.join(srcDir, 'layouts', 'BaseLayout.astro'), 'utf8');

    expect(source).toContain('metadata?: MetaData');
    expect(source).toContain('frontmatter?:');
    const topLevelLegacyProps = source
      .split('\n')
      .filter((line) => line.startsWith('  ') && !line.startsWith('    '))
      .filter((line) => /(?:title|description|image)\?: string;/.test(line));

    expect(topLevelLegacyProps).toEqual([]);
  });

  it('keeps search browser behavior in the owning component and browser-only utility', () => {
    const searchPage = fs.readFileSync(path.join(srcDir, 'pages', 'buscar.astro'), 'utf8');
    const pureSearchUrl = fs.readFileSync(path.join(srcDir, 'utils', 'search-url.ts'), 'utf8');
    const searchComponent = fs.readFileSync(
      path.join(srcDir, 'components', 'common', 'SearchInterface.astro'),
      'utf8'
    );

    expect(searchPage).toContain('SearchInterface');
    expect(searchPage).not.toMatch(/<script[\s>]/);
    expect(pureSearchUrl).not.toMatch(/\b(?:window|document|history)\b/);
    expect(searchComponent).toContain("from '~/utils/browser/search-url'");
  });

  it('keeps public UI copy away from generic AI-magazine phrasing', () => {
    const uiFiles = collectFiles(srcDir, (filePath) => {
      const relative = path.relative(srcDir, filePath);
      return (
        /\.(astro|ts)$/.test(filePath) &&
        /^(components|layouts|pages|navigation\.ts)/.test(relative)
      );
    });

    const bannedPhrases = [
      'Noticiencias Daily Desk',
      'Radar de temas',
      'Por qué importa',
      'En simple',
      'Contexto editorial',
      'Nivel de confianza',
      'Seguir leyendo',
      'sin ruido',
      'sin spam',
      'contexto útil',
      'Lectura guiada',
    ];

    const violations = uiFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return bannedPhrases
        .filter((phrase) => source.includes(phrase))
        .map((phrase) => `${path.relative(repoRoot, filePath)}: ${phrase}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps Xataka-inspired retention separate from commerce modules', () => {
    const scannedFiles = collectFiles(srcDir, (filePath) => {
      const relative = path.relative(srcDir, filePath);
      if (!/\.(astro|ts|md)$/.test(filePath)) return false;
      if (relative === path.join('pages', 'privacidad.md')) return false;
      if (relative === path.join('pages', 'terminos.md')) return false;
      return /^(components|layouts|pages|navigation\.ts)/.test(relative);
    });

    const commerceTerms = [
      'Xataka Selección',
      'afiliad',
      'affiliate',
      'oferta',
      'descuento',
      'shopping',
      'deals',
      'chollos',
      'compras',
    ];

    const violations = scannedFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8').toLowerCase();
      return commerceTerms
        .filter((term) => source.includes(term.toLowerCase()))
        .map((term) => `${path.relative(repoRoot, filePath)}: ${term}`);
    });

    expect(violations).toEqual([]);
  });

  it('renders Hub V1 public surfaces with canonical metadata after build', () => {
    for (const route of [
      '/',
      '/blog/',
      '/buscar/',
      '/newsletter/',
      '/metodologia/',
      '/transparencia/',
    ]) {
      const page = load(readDistHtml(route));
      const canonical = page('link[rel="canonical"]').attr('href');
      expect(page('title').text()).toContain('Noticiencias');
      expect(canonical).toMatch(/^https:\/\/noticiencias\.com/);
    }
  });

  it('renders the En seguimiento habit loop on hub surfaces', () => {
    for (const route of [
      '/',
      '/blog/',
      '/categorias/ciencia/',
      '/temas/materia-oscura/',
      '/ciencia/2026-05-15-un-asteroide-de-700-metros-rota-cada-1-88-minutos-desafiando-teorias-astronomicas/',
    ]) {
      const page = load(readDistHtml(route));
      expect(page('[data-retention-topic-strip]').length, route).toBeGreaterThan(0);
    }
  });

  it('keeps the newsletter capture accessible when no provider endpoint is configured', () => {
    const page = load(readDistHtml('/newsletter/'));
    const form = page('form[aria-label="Suscripción al boletín"]');
    expect(form.length).toBe(1);
    expect(form.find('input[type="email"]').attr('disabled')).toBeDefined();
    expect(form.find('button[type="submit"]').attr('disabled')).toBeDefined();
    expect(page.text()).toContain('La captura de correos se activará');
  });
});
