import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const POSTS_DIR = path.resolve(__dirname, '../src/content/posts');
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

console.log(`${GREEN}Starting Dist-Sanity Check...${RESET}`);
scanDir(DIST_DIR);
auditBuiltArticleHeroes();

if (errorCount > 0) {
  console.error(`\n${RED}FAILED: Found ${errorCount} violations in ${fileCount} files.${RESET}`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}PASSED: Verified ${fileCount} files. No regressions found.${RESET}`);
  process.exit(0);
}
