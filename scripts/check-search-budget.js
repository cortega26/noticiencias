/**
 * Search artifact budget validator (plan 039).
 *
 * Usage: node scripts/check-search-budget.js [path-to-dist]
 *
 * Validates:
 *   - search.json exists and is valid JSON
 *   - artifact has version, index, store keys
 *   - store entries do NOT contain 'content' (raw post body)
 *   - numeric MiniSearch document IDs map to unique canonical URLs
 *   - store has at least one entry
 *   - deterministic serialization (numeric IDs and canonical URLs sorted)
 *   - gzip size under 150KB (deployment-friendly ceiling)
 *
 * Exits 0 on success, 1 on failure.
 *
 * Search artifact v3 uses MiniSearch's compact, serializable full-text index.
 * It keeps the full normalized article body searchable and filters only
 * configured Spanish stop words. The 150 KiB ceiling is unchanged.
 * Historical measurements and the Pagefind comparison are recorded in
 * docs/search-budget-verdict.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const distPath = resolve(process.argv[2] || 'dist');
const searchJsonPath = resolve(distPath, 'search.json');

const GZIP_CEILING = 150 * 1024; // 150KB deployment-friendly ceiling
const GZIP_WARN = 135 * 1024; // early warning: review index growth and options

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
if (artifact.version !== 3) {
  fail(`search artifact version is ${artifact.version}, expected 3`);
}
if (!artifact.index) {
  fail('search artifact is missing the index field');
}
if (
  artifact.index.serializationVersion !== 2 ||
  !Number.isInteger(artifact.index.documentCount) ||
  !Array.isArray(artifact.index.index) ||
  !artifact.index.documentIds ||
  typeof artifact.index.documentIds !== 'object'
) {
  fail('search artifact does not contain a valid MiniSearch serialized index');
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

// Require a dense numeric sequence so every MiniSearch document ID maps to a
// canonical URL in the display store.
const refs = storeEntries.map(([ref]) => ref);
for (const [position, ref] of refs.entries()) {
  if (ref !== String(position)) {
    fail(`search store ref ${ref} at position ${position} is not a sequential numeric identifier`);
  }
}
if (artifact.index.documentCount !== refs.length) {
  fail(`MiniSearch document count is ${artifact.index.documentCount}, expected ${refs.length}`);
}
const indexRefs = Object.values(artifact.index.documentIds);
if (
  indexRefs.length !== refs.length ||
  indexRefs.some((ref, position) => ref !== String(position))
) {
  fail('MiniSearch document IDs do not match the ordered result store');
}

const urls = storeEntries.map(([ref, entry]) => {
  if (!entry || typeof entry.url !== 'string' || !entry.url.startsWith('/')) {
    fail(`search store ref ${ref} has no canonical relative URL`);
  }
  return entry.url;
});
const uniqueUrls = new Set(urls);
if (uniqueUrls.size !== urls.length) {
  fail(`store has ${urls.length} entries but only ${uniqueUrls.size} unique URLs (duplicates)`);
}

// The numeric refs correspond to documents sorted by canonical URL.
const sortedUrls = [...urls].sort((a, b) => a.localeCompare(b));
if (JSON.stringify(urls) !== JSON.stringify(sortedUrls)) {
  fail('search store URLs are not sorted — artifact serialization is not deterministic');
}

// Check gzip size
const rawBytes = Buffer.byteLength(raw, 'utf-8');
const gzipped = gzipSync(Buffer.from(raw, 'utf-8'));
console.log(`  artifact: ${rawBytes} bytes raw, ${gzipped.length} bytes gzip`);
if (gzipped.length > GZIP_CEILING) {
  fail(`gzip size ${gzipped.length} exceeds ${GZIP_CEILING} ceiling (deployment-friendly)`);
}
if (gzipped.length > GZIP_WARN) {
  console.warn(
    `⚠️  gzip size ${gzipped.length} exceeds ${GZIP_WARN} warn threshold — review index growth and search options`
  );
}

// Check bloated fixture (for the regression-injection test)
if (rawBytes > 500 * 1024 && urls.length < 10) {
  fail(
    `raw size ${rawBytes} is suspiciously large for only ${urls.length} entries (bloated fixture?)`
  );
}

console.log(
  `✅ search artifact is valid: ${storeEntries.length} entries, ${gzipped.length} bytes gzip`
);
process.exit(0);
