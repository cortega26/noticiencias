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

describe('quick wins regression coverage', () => {
  it('emits page-specific metadata for pages that previously fell back to defaults', () => {
    const search = load(readDistHtml('/buscar/'));
    expect(search('title').text()).toBe('Buscar Noticias | Noticiencias');
    expect(search('meta[name="description"]').attr('content')).toBe(
      'Utiliza nuestro motor de búsqueda para encontrar artículos, noticias e investigaciones científicas publicadas por Noticiencias sobre ciencia, tecnología e internet.'
    );

    const hypeDetector = load(readDistHtml('/recursos/detector-de-hype/'));
    expect(hypeDetector('title').text()).toBe(
      'Detector de hype: leer ciencia sin que te vendan humo | Noticiencias'
    );
    expect(hypeDetector('meta[name="description"]').attr('content')).toBe(
      'Las preguntas que usamos en Noticiencias para distinguir un hallazgo real de una promesa de marketing, y que puedes aplicar a cualquier titular.'
    );
  });

  it('keeps RSS item links on canonical permalink routes', () => {
    const rssPath = path.join(distDir, 'rss.xml');
    expect(fs.existsSync(rssPath), 'Built RSS feed missing. Run npm run build.').toBe(true);

    const rss = fs.readFileSync(rssPath, 'utf8');
    expect(rss).not.toContain('/posts/');
    expect(rss).toContain(
      'https://noticiencias.com/ciencia/2026-01-18-nasa-se-prepara-para-un-paso-historico-en-la-exploracion-espacial-humana-con-artemis-ii/'
    );
  });

  it('does not reintroduce the retired template layer (ADR-0014)', () => {
    const sourceFiles = collectFiles(srcDir, (filePath) =>
      /\.(astro|ts|js|md|mdx)$/.test(filePath)
    );
    const violations = sourceFiles.filter((filePath) =>
      /(?:components|layouts)\/template\//.test(fs.readFileSync(filePath, 'utf8'))
    );

    expect(violations).toEqual([]);
    expect(fs.existsSync(path.join(srcDir, 'components', 'template'))).toBe(false);
    expect(fs.existsSync(path.join(srcDir, 'layouts', 'template'))).toBe(false);
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
    // `search.ts` holds the pure, DOM-free query/document normalization logic;
    // the DOM-touching URL <-> browser wiring lives only in `browser/search-url.ts`.
    const pureSearchLogic = fs.readFileSync(path.join(srcDir, 'utils', 'search.ts'), 'utf8');
    const searchComponent = fs.readFileSync(
      path.join(srcDir, 'components', 'common', 'SearchInterface.astro'),
      'utf8'
    );

    expect(searchPage).toContain('SearchInterface');
    expect(searchPage).not.toMatch(/<script[\s>]/);
    expect(pureSearchLogic).not.toMatch(/\b(?:window|document|history)\b/);
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

  it('renders topic navigation only on hub surfaces with repeated topics', () => {
    let renderedStrips = 0;

    for (const route of [
      '/',
      '/blog/',
      '/categorias/ciencia/',
      '/temas/materia-oscura/',
      '/ciencia/2026-05-15-un-asteroide-de-700-metros-rota-cada-1-88-minutos-desafiando-teorias-astronomicas/',
    ]) {
      const page = load(readDistHtml(route));
      const strips = page('[data-retention-topic-strip]');
      renderedStrips += strips.length;

      strips.each((_, strip) => {
        expect(page(strip).find('a[href^="/temas/"]').length, route).toBeGreaterThan(0);
      });
    }

    expect(renderedStrips).toBeGreaterThan(0);
  });

  it('hides unverified subscription forms and promises across built surfaces', () => {
    const htmlFiles = collectFiles(distDir, (file) => file.endsWith('.html'));
    for (const file of htmlFiles) {
      const page = load(fs.readFileSync(file, 'utf8'));
      expect(page('form[data-newsletter-form]').length, file).toBe(0);
      expect(page('form[action*="buttondown"]').length, file).toBe(0);
      expect(page('input[type="email"]').length, file).toBe(0);
      expect(page('a[href="/newsletter/"]').length, file).toBe(0);
      expect(page('main').text(), file).not.toMatch(
        /suscr[ií]b(?:ete|irme|irse)|recibirás un correo de confirmación/i
      );
    }
    expect(fs.readFileSync(path.join(distDir, 'llms.txt'), 'utf8')).not.toContain(
      'Suscripción al boletín'
    );
  });

  it('offers RSS and archive on the legacy newsletter route', () => {
    const page = load(readDistHtml('/newsletter/'));
    expect(page('main').text()).toContain('Las suscripciones por correo están deshabilitadas');
    expect(page('main a[href="/rss.xml"]').length).toBe(1);
    expect(page('main a[href="/blog/"]').length).toBe(1);
  });

  it('promotes both evidence portfolios on the homepage', () => {
    const page = load(readDistHtml('/'));
    const guides = page('section[aria-labelledby="home-guides"]');
    expect(guides.find('a[href="/recursos/carbono-bosques-suelos/"]').length).toBe(1);
    expect(guides.find('a[href="/recursos/exoplanetas-atmosferas-biosignaturas/"]').length).toBe(1);
    expect(page('h1').length).toBe(1);
    expect(page('h1').text()).toContain('Ciencia en español, con la evidencia a la vista');
    const lead = page('section[aria-label="Historia principal"] figure').first();
    // The image disclosure is shown on the article page; home keeps it as alt only.
    expect(lead.find('figcaption').length).toBe(0);
    expect(lead.find('img').attr('alt')).toBeTruthy();
  });
});
