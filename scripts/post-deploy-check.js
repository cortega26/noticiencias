
import { load } from 'cheerio';

const TARGET_URL = process.argv[2] || process.env.DEPLOY_URL || 'http://localhost:4321';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log(`${YELLOW}Starting Post-Deploy Check against: ${TARGET_URL}${RESET}`);

async function fetchHtml(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.text();
    } catch (e) {
        console.error(`${RED}[FAIL] Failed to fetch ${url}: ${e.message}${RESET}`);
        process.exit(1);
    }
}

async function verifyHome() {
    console.log(`Checking Home Page...`);
    const html = await fetchHtml(TARGET_URL);
    const $ = load(html);

    // 1. Check Title
    const title = $('title').text();
    if (!title.includes('Noticiencias')) {
        console.error(`${RED}[FAIL] Home title missing 'Noticiencias'. Got: "${title}"${RESET}`);
        process.exit(1);
    }

    // 2. Check Articles
    const articles = $('article');
    if (articles.length < 3) {
        console.error(`${RED}[FAIL] Home page has fewer than 3 articles. Found: ${articles.length}${RESET}`);
        process.exit(1);
    }
    console.log(`${GREEN}[PASS] Home Page OK (${articles.length} articles)${RESET}`);

    // 3. Return a link to test details
    const firstArticleLink = articles.first().find('a').attr('href');
    if (!firstArticleLink) {
         console.warn(`${YELLOW}[WARN] No article link found to verify details.${RESET}`);
         return null;
    }
    // Handle relative links
    return new URL(firstArticleLink, TARGET_URL).toString();
}

async function verifyArticle(url) {
    if (!url) return;
    console.log(`Checking Article: ${url}...`);
    const html = await fetchHtml(url);
    const $ = load(html);

    // Check for 404 text just in case stats 200 returned error page
    if ($('h1').text().includes('404') || $('title').text().includes('404')) {
        console.error(`${RED}[FAIL] Article page appears to be a 404.${RESET}`);
        process.exit(1);
    }

    // Check for Image
    if ($('img').length === 0) {
        console.warn(`${YELLOW}[WARN] Article has no images.${RESET}`);
    }

    console.log(`${GREEN}[PASS] Article Page OK${RESET}`);
}

async function verifySearch() {
    const searchUrl = new URL('/search.json', TARGET_URL).toString();
    console.log(`Checking Search Index: ${searchUrl}...`);
    try {
        const res = await fetch(searchUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        
        if (!Array.isArray(json)) {
            throw new Error('Search index is not an array');
        }
        if (json.length === 0) {
             console.warn(`${YELLOW}[WARN] Search index is empty.${RESET}`);
        } else {
             // Verify schema of first item
             const item = json[0];
             if (!item.title || !item.slug) {
                 throw new Error('Search item missing required fields (title, slug)');
             }
        }
        console.log(`${GREEN}[PASS] Search Index OK (${json.length} items)${RESET}`);
    } catch (e) {
        console.error(`${RED}[FAIL] Search Index verification failed: ${e.message}${RESET}`);
        process.exit(1);
    }
}

async function main() {
    const articleUrl = await verifyHome();
    await verifyArticle(articleUrl);
    await verifySearch();
    console.log(`\n${GREEN}All Post-Deploy Checks PASSED!${RESET}`);
}

main();
