import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const POSTS_DIR = path.resolve(REPO_ROOT, 'src', 'content', 'posts');
export const ASSETS_IMAGES_DIR = path.resolve(REPO_ROOT, 'src', 'assets', 'images');
export const MANIFEST_PATH = path.resolve(REPO_ROOT, 'data', 'image-derivatives-manifest.json');
export const POSTS_DIR_PREFIX = `${POSTS_DIR}${path.sep}`;
export const VALID_POST_EXTENSIONS = new Set(['.md', '.mdx']);
export const TARGET_WIDTHS = [400, 900, 1400];
export const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
export const IMAGE_SOURCE_PREFIX = '~/assets/images/';

export function assertWithinPostsDir(absPath) {
  const normalized = path.resolve(absPath);
  if (normalized !== POSTS_DIR && !normalized.startsWith(POSTS_DIR_PREFIX)) {
    throw new Error(`Path escapes posts directory boundary: ${normalized}`);
  }
  return normalized;
}

export function walkPostFiles(dir = POSTS_DIR, results = []) {
  const safeDir = assertWithinPostsDir(dir);

  if (!fs.existsSync(safeDir)) return results;
  const entries = fs.readdirSync(safeDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = assertWithinPostsDir(path.resolve(safeDir, entry.name));
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkPostFiles(fullPath, results);
    } else if (entry.isFile() && VALID_POST_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

export function extractFrontmatter(content) {
  if (!content.startsWith('---\n')) return '';
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) return '';
  return content.slice(4, endIdx);
}

export function parsePostFrontmatter(filePath) {
  const safeFile = assertWithinPostsDir(filePath);
  const content = fs.readFileSync(safeFile, 'utf8');
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return null;

  const parsed = yaml.load(frontmatter);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Frontmatter could not be parsed as an object: ${safeFile}`);
  }

  return parsed;
}

export function isLocalRasterImageSource(imageSrc) {
  if (typeof imageSrc !== 'string' || !imageSrc.startsWith(IMAGE_SOURCE_PREFIX)) {
    return false;
  }

  return RASTER_EXTENSIONS.has(path.extname(imageSrc).toLowerCase());
}

export function getPostImageSource(parsedFrontmatter) {
  const imageValue = parsedFrontmatter?.image;
  if (!imageValue) return null;

  const imageSrc =
    typeof imageValue === 'string'
      ? imageValue.trim()
      : typeof imageValue === 'object' && imageValue !== null && typeof imageValue.src === 'string'
        ? imageValue.src.trim()
        : '';

  return isLocalRasterImageSource(imageSrc) ? imageSrc : null;
}

export function collectLocalPostImageSources() {
  const sourceKeys = new Set();

  for (const file of walkPostFiles()) {
    const parsed = parsePostFrontmatter(file);
    if (!parsed) continue;
    const sourceKey = getPostImageSource(parsed);
    if (sourceKey) {
      sourceKeys.add(sourceKey);
    }
  }

  return [...sourceKeys].sort();
}

export function getAssetImagePathFromSourceKey(sourceKey) {
  if (!isLocalRasterImageSource(sourceKey)) {
    throw new Error(`Unsupported local raster source key: ${sourceKey}`);
  }

  const filename = sourceKey.replace(IMAGE_SOURCE_PREFIX, '');
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    path.basename(filename) !== filename
  ) {
    throw new Error(`Invalid image filename in source key: ${sourceKey}`);
  }

  return path.resolve(ASSETS_IMAGES_DIR, filename);
}

export async function getImageMetadata(absPath) {
  const metadata = await sharp(absPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine image dimensions for ${absPath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

export function computeContentHash(absPath) {
  const buffer = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

export function computeVariantWidths(originalWidth) {
  const limited = TARGET_WIDTHS.filter((width) => width < originalWidth);
  const widths = [...limited, originalWidth];
  return [...new Set(widths)].sort((a, b) => a - b);
}

export function computeVariantHeight(originalWidth, originalHeight, width) {
  return Math.round((originalHeight / originalWidth) * width);
}

export function deriveObjectKey(sourceKey, hash, width, format = 'avif') {
  const normalizedSource = sourceKey
    .replace(IMAGE_SOURCE_PREFIX, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\//g, '__');

  return `posts/${normalizedSource}.${hash}.${width}.${format}`;
}

export function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

export function writeManifest(manifest) {
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const previous = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : null;
  if (previous === serialized) {
    return false;
  }

  fs.writeFileSync(MANIFEST_PATH, serialized, 'utf8');
  return true;
}

export function buildPublicUrl(baseUrl, objectKey) {
  if (!baseUrl) return null;
  return String(new URL(objectKey, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`));
}
