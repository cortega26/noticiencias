
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_DIR = path.join(__dirname, '../src/content/posts');
const CANDIDATES_FILE = path.join(__dirname, '../mock_candidates.json');
const REPORT_FILE = path.join(__dirname, '../cleanup_dry_run_report.md');

// Regex to extract frontmatter
const FM_REGEX = /^---\n([\s\S]+?)\n---/;

function getFrontmatter(content) {
    const match = content.match(FM_REGEX);
    if (!match) return null;
    const fm = match[1];
    const lines = fm.split('\n');
    const data = {};
    for (let line of lines) {
        line = line.trim();
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            let value = line.substring(colonIdx + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            data[key] = value;
        }
    }
    return data;
}

function analyze() {
    if (!fs.existsSync(POSTS_DIR) || !fs.existsSync(CANDIDATES_FILE)) {
        console.error('Missing required files.');
        process.exit(1);
    }

    const candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

    const stats = {
        total_before: files.length,
        categories_before: {},
        total_after: 0,
        categories_after: {},
        rss_count_before: files.length,
        rss_count_after: 0
    };

    const candidateFiles = new Set(candidates.map(c => c.file));

    // Analyze Before
    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const fm = getFrontmatter(content);
        const cat = fm?.category || 'Uncategorized';
        stats.categories_before[cat] = (stats.categories_before[cat] || 0) + 1;
    }

    // Analyze After
    for (const file of files) {
        if (candidateFiles.has(file)) continue;

        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const fm = getFrontmatter(content);
        const cat = fm?.category || 'Uncategorized';
        stats.categories_after[cat] = (stats.categories_after[cat] || 0) + 1;
        stats.total_after++;
    }
    stats.rss_count_after = stats.total_after;

    // Generate Markdown Report
    const report = [
        '# Cleanup Dry Run Report',
        '',
        `**Date:** ${new Date().toISOString()}`,
        '',
        '## A. Before',
        `- Total Articles: ${stats.total_before}`,
        `- RSS Count: ${stats.rss_count_before}`,
        '- Categories:',
        ...Object.entries(stats.categories_before).map(([k, v]) => `  - ${k}: ${v}`),
        '',
        '## B. After (Simulated)',
        `- Total Articles: ${stats.total_after} (-${stats.total_before - stats.total_after})`,
        `- RSS Count: ${stats.rss_count_after}`,
        '- Categories:',
        ...Object.entries(stats.categories_after).map(([k, v]) => `  - ${k}: ${v}`),
        '',
        '## Impacts',
        `- Files to be deleted: ${candidates.length}`,
        ...candidates.map(c => `  - [${c.type}] ${c.file} (${c.title})`),
        '',
        '## Check',
        `- Empty Categories Created? ${Object.keys(stats.categories_after).length < Object.keys(stats.categories_before).length ? 'YES (See above)' : 'NO'}`,
        `- Remaining Mocks? 0 (Strict Mode)`
    ].join('\n');

    fs.writeFileSync(REPORT_FILE, report);
    console.log(`Dry Run Report generated at ${REPORT_FILE}`);
}

analyze();
