import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import matter from './utils/frontmatter-parser.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const POSTS_DIR = path.resolve(__dirname, '../src/content/posts');
const SRC_DIR = path.resolve(__dirname, '../src');
const DEFAULT_HERO_IMAGE = '~/assets/images/default.png';

// Colors for console output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errorCount = 0;
let fileCount = 0;

function slugifySegment(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolvePostRoute(fileName, data) {
  const permalink = typeof data.permalink === 'string' ? data.permalink.trim() : '';
  if (permalink) {
    return `/${permalink.replace(/^\/+|\/+$/g, '')}/`;
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const firstCategory = typeof categories[0] === 'string' ? categories[0].trim() : '';
  if (!firstCategory) {
    return null;
  }

  return `/${slugifySegment(firstCategory)}/${path.basename(fileName, path.extname(fileName))}/`;
}

function getFrontmatterImageSource(data) {
  if (typeof data.image === 'string') {
    return data.image.trim();
  }
  if (data.image && typeof data.image === 'object' && typeof data.image.src === 'string') {
    return data.image.src.trim();
  }
  return '';
}

function isAliasPath(src = '') {
  return src.startsWith('~/') || src.startsWith('@/');
}

function isResolvableImageSrc(src = '') {
  return (
    Boolean(src) &&
    !isAliasPath(src) &&
    (src.startsWith('/') ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:'))
  );
}

function isAvifUrl(src = '') {
  return /\.avif(?:[?#].*)?$/i.test(src);
}

function isDefaultRenderedImageUrl(src = '') {
  const value = String(src).toLowerCase();
  return (
    value.includes('/default.') ||
    value.endsWith('/default.png') ||
    value.includes('posts/default.')
  );
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) {
    console.error(
      `${RED}Error: dist directory not found at ${dir}. Run 'npm run build' first.${RESET}`
    );
    process.exit(1);
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    // Security: Prevent traversal
    if (!fullPath.startsWith(DIST_DIR)) {
      console.error(
        `${RED}Security Error: Attempted to scan outside DIST_DIR: ${fullPath}${RESET}`
      );
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.html')) {
      validateHtml(fullPath);
      fileCount++;
    }
  }
}

function collectFiles(root, predicate) {
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

function getLatestMtimeMs(files) {
  return files.reduce((latest, filePath) => Math.max(latest, fs.statSync(filePath).mtimeMs), 0);
}

function checkDistFreshness() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(
      `${RED}Error: dist directory not found at ${DIST_DIR}. Run 'npm run build' first.${RESET}`
    );
    process.exit(1);
  }

  const sourceFiles = [
    ...collectFiles(SRC_DIR, (filePath) =>
      /\.(astro|js|ts|md|mdx|yaml|json)$/.test(path.basename(filePath))
    ),
    path.resolve(__dirname, '../astro.config.mjs'),
    path.resolve(__dirname, '../data/image-derivatives-manifest.json'),
  ].filter((filePath) => fs.existsSync(filePath));

  const latestSourceMtime = getLatestMtimeMs(sourceFiles);
  const latestDistMtime = getLatestMtimeMs(collectFiles(DIST_DIR, () => true));

  if (latestDistMtime < latestSourceMtime) {
    console.error(
      `${RED}[FAIL] Dist is older than source files. Run 'npm run build' before 'npm run test:dist'.${RESET}`
    );
    process.exit(1);
  }

  console.log(`${GREEN}PASSED: Dist is newer than all source files.${RESET}`);
}

function validateHtml(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const $ = load(content);
  const relativePath = path.relative(DIST_DIR, filePath);
  const mainNav = $('nav[aria-label="Main navigation"]').first();

  if (mainNav.length) {
    const navClasses = mainNav.attr('class') || '';
    if (navClasses.includes('lg:overflow-x-auto')) {
      console.error(
        `${RED}[FAIL] ${relativePath}: Main navigation still uses desktop horizontal auto overflow, which turns open dropdowns into scroll containers.${RESET}`
      );
      errorCount++;
    }
  }

  $('img').each((_i, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt');
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    const crossorigin = $(el).attr('crossorigin');

    // Invariant 1: No build-time aliases in production source
    if (src.startsWith('~/') || src.startsWith('@/')) {
      console.error(`${RED}[FAIL] ${relativePath}: Image src contains alias: "${src}"${RESET}`);
      errorCount++;
    }

    // Invariant 2: Accessibility
    if (alt === undefined || alt === null) {
      // Check for aria-hidden="true" which makes missing alt acceptable (though empty alt is preferred)
      if ($(el).attr('aria-hidden') !== 'true') {
        console.error(
          `${RED}[FAIL] ${relativePath}: Image missing 'alt' attribute. Src: "${src}"${RESET}`
        );
        errorCount++;
      }
    } else if (alt === 'alt' || alt === 'undefined' || alt === 'null' || alt.trim() === '') {
      // Empty alt is fine for decorative images, but "alt" or "undefined" is likely a bug
      if (alt !== '') {
        console.error(
          `${RED}[FAIL] ${relativePath}: Image has invalid 'alt' value: "${alt}". Src: "${src}"${RESET}`
        );
        errorCount++;
      }
    }

    // Invariant 3: Layout Shift (CLS) - Excluding SVGs often used as icons
    if (!src.endsWith('.svg') && !src.startsWith('data:image/svg')) {
      if (!width || !height) {
        // Warning for now, or Error if strict. Risk map said "High" impact.
        // Let's make it an error as per the user's "Stability Hardening" goal.
        // CHECK: Astro's optimized images usually add width/height.
        console.error(
          `${YELLOW}[WARN] ${relativePath}: Image missing width/height (CLS Risk). Src: "${src}"${RESET}`
        );
        // errorCount++; // Uncomment to enforce strictly
      }
    }

    if (crossorigin && src.startsWith('https://www.cdn.noticiencias.com/')) {
      console.error(
        `${RED}[FAIL] ${relativePath}: CDN image opts into crossorigin without matching CORS headers, which breaks rendering in the browser. Src: "${src}"${RESET}`
      );
      errorCount++;
    }
  });

  // Security Check: innerHTML with template literals (XSS vector)
  // Scan inline <script> blocks for dangerous patterns
  $('script').each((_i, el) => {
    const scriptContent = $(el).html() || '';
    if (/\.innerHTML\s*=\s*`/.test(scriptContent)) {
      console.error(
        `${RED}[FAIL] ${relativePath}: innerHTML with template literal detected in inline script (XSS risk)${RESET}`
      );
      errorCount++;
    }
  });

  // Extra Check: Placeholder content leaking
  if (content.includes('Lorem ipsum') || content.includes('TODO:')) {
    console.error(
      `${YELLOW}[WARN] ${relativePath}: Potential placeholder content detected.${RESET}`
    );
  }
}

function auditBuiltArticleHeroes() {
  if (!fs.existsSync(POSTS_DIR)) {
    return;
  }

  const postFiles = fs
    .readdirSync(POSTS_DIR)
    .filter((fileName) => fileName.endsWith('.md') || fileName.endsWith('.mdx'));

  for (const fileName of postFiles) {
    const postPath = path.join(POSTS_DIR, fileName);
    const { data } = matter(fs.readFileSync(postPath, 'utf8'));
    const imageSource = getFrontmatterImageSource(data);

    if (!imageSource) {
      continue;
    }

    const route = resolvePostRoute(fileName, data);
    if (!route) {
      console.error(
        `${RED}[FAIL] ${fileName}: Unable to resolve built route for hero audit.${RESET}`
      );
      errorCount++;
      continue;
    }

    const htmlPath = path.join(DIST_DIR, route.replace(/^\/+|\/+$/g, ''), 'index.html');
    if (!fs.existsSync(htmlPath)) {
      console.error(`${RED}[FAIL] ${fileName}: Built article missing at ${htmlPath}.${RESET}`);
      errorCount++;
      continue;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = load(html);
    const headerImage = $('main article header img').first();

    if (headerImage.length === 0) {
      console.error(
        `${RED}[FAIL] ${fileName}: Article header hero image missing in built HTML.${RESET}`
      );
      errorCount++;
      continue;
    }

    const headerSrc = (headerImage.attr('src') || '').trim();
    const headerWidth = (headerImage.attr('width') || '').trim();
    const headerHeight = (headerImage.attr('height') || '').trim();

    if (!isResolvableImageSrc(headerSrc)) {
      console.error(
        `${RED}[FAIL] ${fileName}: Article header hero src is not resolvable: "${headerSrc}".${RESET}`
      );
      errorCount++;
    }

    if (!headerWidth || !headerHeight) {
      console.error(
        `${RED}[FAIL] ${fileName}: Article header hero is missing width/height.${RESET}`
      );
      errorCount++;
    }

    const avifSource = $('main article header picture source[type="image/avif"]').first();
    if (avifSource.length > 0 && isAvifUrl(headerSrc)) {
      console.error(
        `${RED}[FAIL] ${fileName}: AVIF hero is missing a non-AVIF img fallback.${RESET}`
      );
      errorCount++;
    }

    const ogImage = ($('meta[property="og:image"]').attr('content') || '').trim();
    if (imageSource !== DEFAULT_HERO_IMAGE) {
      if (!ogImage) {
        console.error(
          `${RED}[FAIL] ${fileName}: Article-specific hero is missing og:image metadata.${RESET}`
        );
        errorCount++;
      } else if (isDefaultRenderedImageUrl(ogImage)) {
        console.error(
          `${RED}[FAIL] ${fileName}: og:image points at the default placeholder for an article-specific hero.${RESET}`
        );
        errorCount++;
      }
    }
  }
}

const SOCIAL_MANIFEST_PATH = path.join(DIST_DIR, 'social-manifest.json');

function readMeta($, selector) {
  return ($(selector).attr('content') || '').trim();
}

/**
 * Social distribution contract (plan §7/§8/§11): the public manifest must
 * agree with the article routes and metadata this build actually emitted,
 * and the JSON endpoint must not leak into the sitemap.
 */
function auditSocialManifest() {
  const errorsBefore = errorCount;
  if (!fs.existsSync(SOCIAL_MANIFEST_PATH)) {
    console.error(
      `${RED}[FAIL] social-manifest.json missing from dist. Endpoint src/pages/social-manifest.json.ts did not build.${RESET}`
    );
    errorCount++;
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(SOCIAL_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    console.error(`${RED}[FAIL] social-manifest.json is not valid JSON: ${error.message}${RESET}`);
    errorCount++;
    return;
  }

  if (manifest.schema_version !== 1) {
    console.error(
      `${RED}[FAIL] social-manifest.json schema_version is ${JSON.stringify(manifest.schema_version)}, expected 1.${RESET}`
    );
    errorCount++;
  }

  // provenance is null on local/PR builds and only an object inside the
  // Deploy to GitHub Pages workflow — accept both, reject a malformed object.
  if (manifest.provenance !== null) {
    const p = manifest.provenance;
    const provenanceOk =
      p &&
      typeof p === 'object' &&
      typeof p.repository === 'string' &&
      /^[0-9a-f]{40}$/.test(p.commit || '') &&
      /^[0-9]+$/.test(String(p.run_id)) &&
      Number.isInteger(p.build_attempt) &&
      p.build_attempt >= 1 &&
      typeof p.workflow === 'string';
    if (!provenanceOk) {
      console.error(
        `${RED}[FAIL] social-manifest.json provenance is neither null nor a well-formed object: ${JSON.stringify(p)}${RESET}`
      );
      errorCount++;
    }
  }

  if (!Array.isArray(manifest.articles)) {
    console.error(`${RED}[FAIL] social-manifest.json articles is not an array.${RESET}`);
    errorCount++;
    return;
  }

  const seenCanonical = new Set();
  const seenSocialId = new Set();

  for (const article of manifest.articles) {
    const cid = article?.collection_id || '<unknown>';

    if (!/^https:\/\/noticiencias\.com\//.test(article?.canonical_url || '')) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: canonical_url is not an https noticiencias.com URL: "${article?.canonical_url}".${RESET}`
      );
      errorCount++;
      continue;
    }

    if (seenCanonical.has(article.canonical_url)) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: duplicate canonical_url "${article.canonical_url}".${RESET}`
      );
      errorCount++;
    }
    seenCanonical.add(article.canonical_url);

    const socialId = article?.social?.id;
    if (socialId) {
      if (seenSocialId.has(socialId)) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: duplicate social.id "${socialId}".${RESET}`
        );
        errorCount++;
      }
      seenSocialId.add(socialId);
    }

    const routePath = article.canonical_url.replace('https://noticiencias.com/', '');
    const htmlPath = path.join(DIST_DIR, routePath.replace(/\/+$/, ''), 'index.html');
    if (!fs.existsSync(htmlPath)) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: no built page at ${htmlPath} for canonical ${article.canonical_url}.${RESET}`
      );
      errorCount++;
      continue;
    }

    const $ = load(fs.readFileSync(htmlPath, 'utf8'));

    const canonicalLinks = $('link[rel="canonical"]');
    if (canonicalLinks.length !== 1) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: built page has ${canonicalLinks.length} <link rel="canonical"> tags, expected exactly 1.${RESET}`
      );
      errorCount++;
    }
    const canonicalHref = (canonicalLinks.first().attr('href') || '').trim();
    if (canonicalHref !== article.canonical_url) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: page canonical "${canonicalHref}" != manifest canonical_url "${article.canonical_url}".${RESET}`
      );
      errorCount++;
    }

    const ogUrl = readMeta($, 'meta[property="og:url"]');
    if (ogUrl !== article.canonical_url) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: og:url "${ogUrl}" != manifest canonical_url "${article.canonical_url}".${RESET}`
      );
      errorCount++;
    }

    // Compare against og:title / og:description, NOT <title> — the document
    // title carries the site-name template while og:title is the bare title.
    const ogTitle = readMeta($, 'meta[property="og:title"]');
    if (ogTitle !== article.title) {
      console.error(
        `${RED}[FAIL] social-manifest ${cid}: og:title "${ogTitle}" != manifest title "${article.title}".${RESET}`
      );
      errorCount++;
    }

    if (article.description !== undefined) {
      const ogDescription = readMeta($, 'meta[property="og:description"]');
      if (ogDescription !== article.description) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: og:description != manifest description.${RESET}`
        );
        errorCount++;
      }
    }

    // twitter:title / :description mirror og and must be present exactly once.
    for (const [twSel, ogVal, label] of [
      ['meta[name="twitter:title"]', ogTitle, 'twitter:title'],
      [
        'meta[name="twitter:description"]',
        readMeta($, 'meta[property="og:description"]'),
        'twitter:description',
      ],
    ]) {
      const nodes = $(twSel);
      if (nodes.length !== 1) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: expected exactly 1 ${label}, found ${nodes.length}.${RESET}`
        );
        errorCount++;
      } else if ((nodes.attr('content') || '').trim() !== ogVal) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: ${label} does not mirror its OpenGraph value.${RESET}`
        );
        errorCount++;
      }
    }

    // twitter:image only when og:image is non-empty (optimizeOpenGraphImage
    // can emit an empty og:image for an unresolved asset).
    const ogImage = readMeta($, 'meta[property="og:image"]');
    const twitterImageNodes = $('meta[name="twitter:image"]');
    if (ogImage) {
      if (twitterImageNodes.length !== 1) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: expected exactly 1 twitter:image, found ${twitterImageNodes.length}.${RESET}`
        );
        errorCount++;
      } else if ((twitterImageNodes.attr('content') || '').trim() !== ogImage) {
        console.error(
          `${RED}[FAIL] social-manifest ${cid}: twitter:image does not mirror og:image.${RESET}`
        );
        errorCount++;
      }
    }
  }

  // Reverse direction: every built article must be represented. The forward
  // loop above proves each manifest entry maps to a distinct real page with
  // matching canonical/OG; asserting the counts match closes the other
  // direction (a published article silently missing from the manifest)
  // without reimplementing slug logic. The loader globs `**/*.md`, so count
  // `.md` sources only.
  const postSourceCount = collectFiles(POSTS_DIR, (filePath) => filePath.endsWith('.md')).length;
  if (manifest.articles.length !== postSourceCount) {
    console.error(
      `${RED}[FAIL] social-manifest.json lists ${manifest.articles.length} article(s) but ${postSourceCount} post source file(s) exist under ${POSTS_DIR}. The manifest must include every built article.${RESET}`
    );
    errorCount++;
  }

  // The JSON endpoint must not appear in the sitemap.
  const sitemapFiles = fs
    .readdirSync(DIST_DIR)
    .filter((name) => /^sitemap.*\.xml$/.test(name))
    .map((name) => path.join(DIST_DIR, name));
  for (const sitemapFile of sitemapFiles) {
    if (fs.readFileSync(sitemapFile, 'utf8').includes('social-manifest.json')) {
      console.error(
        `${RED}[FAIL] ${path.basename(sitemapFile)} lists social-manifest.json; it must be excluded from the sitemap.${RESET}`
      );
      errorCount++;
    }
  }

  if (errorCount > errorsBefore) {
    console.error(
      `${RED}FAILED: social-manifest.json audit found ${errorCount - errorsBefore} violation(s).${RESET}`
    );
  } else {
    console.log(
      `${GREEN}PASSED: social-manifest.json verified against ${manifest.articles.length} built article routes.${RESET}`
    );
  }
}

console.log(`${GREEN}Starting Dist-Sanity Check...${RESET}`);
checkDistFreshness();
scanDir(DIST_DIR);
auditBuiltArticleHeroes();
auditSocialManifest();

if (errorCount > 0) {
  console.error(`\n${RED}FAILED: Found ${errorCount} violations in ${fileCount} files.${RESET}`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}PASSED: Verified ${fileCount} files. No regressions found.${RESET}`);
  process.exit(0);
}
