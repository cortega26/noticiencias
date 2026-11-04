/** Check registered image attribution links and source-file identity, not legal rights. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { matter } from './utils/frontmatter-parser.js';
import { resolveHeroPlaceholderPaths, walkPostFiles } from './utils/hero-placeholders.js';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootArg = process.argv.find((arg) => arg.startsWith('--repoRoot='));
const root = rootArg ? path.resolve(rootArg.slice('--repoRoot='.length)) : defaultRoot;
const manifestPath = path.join(root, 'data/image-attributions.json');
const errors = [];
const posts = walkPostFiles(resolveHeroPlaceholderPaths(root));
const references = new Set();
let entries;

try {
  entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!entries || typeof entries !== 'object' || Array.isArray(entries))
    throw new Error('expected an object');
} catch (error) {
  errors.push({
    file: 'data/image-attributions.json',
    message: `cannot read attribution manifest: ${error.message}`,
  });
  entries = {};
}

function isHttps(value) {
  try {
    return typeof value === 'string' && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

for (const file of posts) {
  const { data } = matter(fs.readFileSync(file, 'utf8'));
  const image = typeof data.image === 'string' ? data.image : data.image?.src;
  const alt = typeof data.image_alt === 'string' ? data.image_alt : (data.image?.alt ?? '');
  if (typeof image !== 'string') continue;
  references.add(image);
  // Explicit CC BY and CC0 labels are checked; other licenses need editorial review.
  const cc = /\bCC\s+BY(-SA)?\s+(\d+\.\d+)\b/i.exec(alt);
  const cc0 = /\bCC0(?:\s+(\d+\.\d+))?\b/i.exec(alt);
  const registeredCC = /^https:\/\/creativecommons\.org\/licenses\/by(?:-sa)?\//.test(
    entries[image]?.license ?? ''
  );
  const cc0License = 'https://creativecommons.org/publicdomain/zero/1.0/';
  const registeredCC0 = entries[image]?.license === cc0License;
  if (registeredCC && !cc) {
    errors.push({
      file: path.relative(root, file),
      message: 'registered CC BY image requires its license in image_alt',
    });
  }
  if (cc) {
    const expected = `https://creativecommons.org/licenses/${cc[1] ? 'by-sa' : 'by'}/${cc[2]}/`;
    if (!entries[image] || entries[image].license !== expected) {
      errors.push({
        file: path.relative(root, file),
        message: 'CC BY image requires matching attribution and license link',
      });
    }
  }
  if (registeredCC0 && !cc0) {
    errors.push({
      file: path.relative(root, file),
      message: 'registered CC0 image requires its dedication in image_alt',
    });
  }
  if (cc0 && ((cc0[1] && cc0[1] !== '1.0') || !registeredCC0)) {
    errors.push({
      file: path.relative(root, file),
      message: 'CC0 image requires matching attribution and dedication link',
    });
  }
}

for (const [image, entry] of Object.entries(entries)) {
  const file = 'data/image-attributions.json';
  const filename = image.replace(/^~\/assets\/images\//, '');
  if (
    !image.startsWith('~/assets/images/') ||
    !filename ||
    path.basename(filename) !== filename ||
    filename.includes('\\')
  ) {
    errors.push({ file, message: `invalid image path: ${image}` });
    continue;
  }
  if (!references.has(image)) errors.push({ file, message: `unreferenced image: ${image}` });
  if (!entry || typeof entry !== 'object' || !isHttps(entry.source) || !isHttps(entry.license)) {
    errors.push({ file, message: `invalid HTTPS source or license: ${image}` });
    continue;
  }
  if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) {
    errors.push({ file, message: `invalid SHA-256: ${image}` });
    continue;
  }
  try {
    const digest = createHash('sha256')
      .update(fs.readFileSync(path.join(root, 'src/assets/images', filename)))
      .digest('hex');
    if (digest !== entry.sha256) errors.push({ file, message: `SHA-256 mismatch: ${image}` });
  } catch {
    errors.push({ file, message: `image not readable: ${image}` });
  }
}

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({
      check: 'image-attributions',
      status: errors.length ? 'fail' : 'pass',
      filesCount: posts.length,
      errors,
    })
  );
} else if (errors.length) {
  console.error(`Image attribution check found ${errors.length} issue(s):`);
  for (const error of errors) console.error(`  - ${error.file}: ${error.message}`);
} else {
  console.log(`Image attribution check passed for ${posts.length} posts.`);
}
if (errors.length) process.exitCode = 1;
