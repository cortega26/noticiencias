import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { parse } from 'csv-parse/sync';

const POSTS_DIR = './src/content/posts';
const CSV_PATH = '../noticiencias/URL_PARITY_REPORT.csv';

// Read CSV
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

const urls = records.map(r => r.url);
const postUrls = urls.filter(url => {
    // Filter heuristics
    if (url.includes('/etiquetas/')) return false;
    if (url.includes('/categorias/')) return false;
    if (url.includes('/assets/')) return false;
    // Exclude the site root on noticiencias.com (e.g. "https://noticiencias.com/")
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'noticiencias.com' && (parsed.pathname === '/' || parsed.pathname === '')) {
            return false;
        }
    } catch {
        // If the URL cannot be parsed, fall back to treating it as a candidate.
    }
    // Known pages
    if (url.includes('/about/')) return false;
    if (url.includes('/docs/')) return false;
    if (url.includes('/buscar/')) return false;
    if (url.includes('/methodology/')) return false;
    if (url.includes('/suscribirse/')) return false;
    if (url.includes('/transparency/')) return false;
    if (url.includes('/noticiencias-plan-master/')) return false; // Page
    // System files
    if (url.includes('isologo.html')) return false;
    if (url.includes('codigo.html')) return false;
    if (url.includes('/AGENTS/')) return false;
    if (url.includes('/CHANGELOG/')) return false;
    if (url.includes('/GEMINI/')) return false;
    if (url.includes('/PULL_REQUEST/')) return false;
    if (url.includes('/SECURITY/')) return false;
    if (url.includes('/migration/')) return false;

    return true;
});

// Read Posts
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

console.log(`Found ${postUrls.length} candidate URLs for ${files.length} posts.`);

files.forEach(file => {
    const filePath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const title = parsed.data.title || '';

    // Normalize title for matching
    // Remove accents, lowercase, remove special chars
    const safeTitle = typeof title === 'string' ? title : String(title || '');
    const normTitle = safeTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

    let bestMatch = null;
    let maxScore = 0;

    postUrls.forEach(url => {
        // Normalize URL slug
        // Extract last parts
        const safeUrl = typeof url === 'string' ? url : String(url || '');
        const slug = safeUrl.replace('https://noticiencias.com', '').replace(/\/$/, '');
        const normSlug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

        // Simple length difference score + substring check?
        // Or check how many chars match?
        // Let's check LCS or just containment

        let score = 0;
        if (normSlug.includes(normTitle)) score = 100;
        else if (normTitle.includes(normSlug)) score = 100;
        else {
            // Jaccard index of trigrams?
            // Simple: split into words and count matches
            const titleWords = title.toLowerCase().split(/\s+/);
            const slugParts = slug.toLowerCase().split(/[/-]/);
            const matches = titleWords.filter(w => w.length > 3 && slugParts.some(s => s.includes(w)));
            score = matches.length;
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = url;
        }
    });

    if (bestMatch && maxScore > 0) {
        console.log(`Matched: ${file} -> ${bestMatch} (Score: ${maxScore})`);

        // Extract relative path
        const relativePath = String(bestMatch).replace('https://noticiencias.com', '');

        // Update frontmatter
        parsed.data.permalink = relativePath;
        const newContent = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(filePath, newContent);
    } else {
        console.warn(`No match found for ${file}`);
    }
});
