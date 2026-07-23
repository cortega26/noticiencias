/**
 * Search artifact budget validator (plan 039).
 *
 * Usage: node scripts/check-search-budget.js [path-to-dist]
 *
 * Validates:
 *   - search.json exists and is valid JSON
 *   - artifact has version, index, store keys
 *   - store entries do NOT contain 'content' (raw post body)
 *   - all canonical refs (URLs) are unique
 *   - store has at least one entry
 *   - deterministic serialization (documents sorted by URL)
 *   - gzip size under 150KB (deployment-friendly ceiling)
 *
 * Exits 0 on success, 1 on failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const distPath = resolve(process.argv[2] || 'dist');
const searchJsonPath = resolve(distPath, 'search.json');

const GZIP_CEILING = 150 * 1024; // 150KB deployment-friendly ceiling

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!existsSync(searchJsonPath)) {
  fail(`search.json not found at ${searchJsonPath}`);
}

const raw = readFileSync(searchJsonPath, 'utf-8');
let artifact;

try {
  artifact = JSON.parse(raw);
} catch (e) {
  fail(`search.json is not valid JSON: ${e.message}`);
}

if (!artifact || typeof artifact !== 'object') {
  fail('search artifact is not an object');
}
if (artifact.version !== 1) {
  fail(`search artifact version is ${artifact.version}, expected 1`);
}
if (!artifact.index) {
  fail('search artifact is missing the index field');
}
if (!artifact.store || typeof artifact.store !== 'object') {
  fail('search artifact is missing the store field');
}

const storeEntries = Object.entries(artifact.store);
if (storeEntries.length === 0) {
  fail('search store is empty');
}

// Check no raw content in store
for (const [url, entry] of storeEntries) {
  if ('content' in entry) {
    fail(`store entry ${url} contains 'content' (raw post body) — should be stripped`);
  }
}

// Check unique canonical refs (URLs)
const urls = storeEntries.map(([url]) => url);
const uniqueUrls = new Set(urls);
if (uniqueUrls.size !== urls.length) {
  fail(`store has ${urls.length} entries but only ${uniqueUrls.size} unique URLs (duplicates)`);
}

// Check deterministic serialization (store keys should be sorted by URL)
const sortedUrls = [...urls].sort();
if (JSON.stringify(urls) !== JSON.stringify(sortedUrls)) {
  console.warn('⚠️  store keys are not sorted by URL — serialization may not be deterministic');
}

// Check gzip size
const gzipped = gzipSync(Buffer.from(raw, 'utf-8'));
console.log(`  artifact: ${raw.length} bytes raw, ${gzipped.length} bytes gzip`);
if (gzipped.length > GZIP_CEILING) {
  fail(`gzip size ${gzipped.length} exceeds ${GZIP_CEILING} ceiling (deployment-friendly)`);
}

// Check bloated fixture (for the regression-injection test)
if (raw.length > 500 * 1024 && urls.length < 10) {
  fail(
    `raw size ${raw.length} is suspiciously large for only ${urls.length} entries (bloated fixture?)`
  );
}

console.log(
  `✅ search artifact is valid: ${storeEntries.length} entries, ${gzipped.length} bytes gzip`
);
process.exit(0);
