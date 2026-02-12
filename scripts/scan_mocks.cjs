
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '../src/content/posts');
const OUTPUT_FILE = path.join(__dirname, '../mock_candidates.json');

// Regex to extract frontmatter
const FM_REGEX = /^---\n([\s\S]+?)\n---/;

function getFrontmatter(content) {
    const match = content.match(FM_REGEX);
    if (!match) return null;
    const fm = match[1];
    const lines = fm.split('\n');
    const data = {};
    let currentKey = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        // Simple key: value parsing
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            let value = line.substring(colonIdx + 1).trim();
            // clean quotes
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (value.startsWith("'") && value.endsWith("'")) {
                value = value.slice(1, -1);
            }
            data[key] = value;
            currentKey = key;
        } else if (currentKey && (line.startsWith('- ') || line.startsWith('  '))) {
             // Continuation or list, simple ignored for source_url/sources check
             // unless we need to strict parse sources list. 
             // "sources:" usually followed by object list.
             // We just check if "sources" key exists.
        }
    }
    return data;
}

function scan() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.error(`Posts directory not found: ${POSTS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`Scanning ${files.length} files in ${POSTS_DIR}...`);

    const candidates = [];
    let processed = 0;

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = getFrontmatter(content);

        if (!fm) {
            console.warn(`[WARN] No frontmatter found for ${file}`);
            continue;
        }

        // Detection Logic
        // Mock if missing "source_url" AND "sources" AND "refinery_id"
        // refinery_id implies it came from the collector, so it might be real even if source_url is missing (edge case?)
        // User said: "Eliminar artículos mock (sin source)".
        const hasSourceUrl = !!fm.source_url;
        const hasSources = content.includes('sources:'); // Simple grep in FM block for complex object key
        const hasRefineryId = !!fm.refinery_id;

        const isMock = !hasSourceUrl && !hasSources && !hasRefineryId;

        if (isMock) {
            // Further Classification
            let type = 'CANDIDATE';
            
            // Check for suspicious internal links (files linking TO this mock)
            // This is expensive to do exhaustively, so we skip for check 1 or do simple grep
            // For now, mark as CANDIDATE. Phase 2 (Dry Run) can do deeper analysis? 
            // Or we check slug usage here.
            
            const slug = fm.slug || file.replace('.md', '');
            
            // Heuristic Protection
            if (slug.includes('welcome') || slug.includes('about') || slug === 'hello-world') {
                type = 'PROTECTED';
            }

            candidates.push({
                file: file,
                slug: slug,
                title: fm.title || 'Unknown',
                date: fm.date || 'Unknown',
                type: type,
                reason: 'Missing source_url, sources, and refinery_id'
            });
        }
        processed++;
    }

    console.log(`\nScan Complete.`);
    console.log(`Total Files: ${processed}`);
    console.log(`Total Mocks Detected: ${candidates.length}`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(candidates, null, 2));
    console.log(`Candidates saved to ${OUTPUT_FILE}`);
}

scan();
