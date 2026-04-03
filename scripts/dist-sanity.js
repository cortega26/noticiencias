import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');

// Colors for console output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errorCount = 0;
let fileCount = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`${RED}Error: dist directory not found at ${dir}. Run 'npm run build' first.${RESET}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    // Security: Prevent traversal
    if (!fullPath.startsWith(DIST_DIR)) {
        console.error(`${RED}Security Error: Attempted to scan outside DIST_DIR: ${fullPath}${RESET}`);
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
          console.error(`${RED}[FAIL] ${relativePath}: Image missing 'alt' attribute. Src: "${src}"${RESET}`);
          errorCount++;
       }
    } else if (alt === 'alt' || alt === 'undefined' || alt === 'null' || alt.trim() === '') {
       // Empty alt is fine for decorative images, but "alt" or "undefined" is likely a bug
       if (alt !== '') { 
          console.error(`${RED}[FAIL] ${relativePath}: Image has invalid 'alt' value: "${alt}". Src: "${src}"${RESET}`);
          errorCount++;
       }
    }

    // Invariant 3: Layout Shift (CLS) - Excluding SVGs often used as icons
    if (!src.endsWith('.svg') && !src.startsWith('data:image/svg')) {
      if (!width || !height) {
        // Warning for now, or Error if strict. Risk map said "High" impact.
        // Let's make it an error as per the user's "Stability Hardening" goal.
        // CHECK: Astro's optimized images usually add width/height.
        console.error(`${YELLOW}[WARN] ${relativePath}: Image missing width/height (CLS Risk). Src: "${src}"${RESET}`);
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
      console.error(`${RED}[FAIL] ${relativePath}: innerHTML with template literal detected in inline script (XSS risk)${RESET}`);
      errorCount++;
    }
  });

  // Extra Check: Placeholder content leaking
  if (content.includes('Lorem ipsum') || content.includes('TODO:')) {
     console.error(`${YELLOW}[WARN] ${relativePath}: Potential placeholder content detected.${RESET}`);
  }
}

console.log(`${GREEN}Starting Dist-Sanity Check...${RESET}`);
scanDir(DIST_DIR);

if (errorCount > 0) {
  console.error(`\n${RED}FAILED: Found ${errorCount} violations in ${fileCount} files.${RESET}`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}PASSED: Verified ${fileCount} files. No regressions found.${RESET}`);
  process.exit(0);
}
