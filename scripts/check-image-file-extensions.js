import fs from 'node:fs';
import path from 'node:path';

const IMAGE_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');

const EXTENSION_BY_KIND = {
  jpeg: new Set(['.jpg', '.jpeg']),
  png: new Set(['.png']),
  webp: new Set(['.webp']),
  gif: new Set(['.gif']),
  avif: new Set(['.avif']),
  svg: new Set(['.svg']),
};

function collectFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(filePath);
    }
    return [filePath];
  });
}

function detectImageKind(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 12) {
    return 'unknown';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'gif';
  }

  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') {
      return 'avif';
    }
  }

  const prefix = buffer.subarray(0, 256).toString('utf8').trimStart();
  if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) {
    return 'svg';
  }

  return 'unknown';
}

const errors = [];

for (const filePath of collectFiles(IMAGE_DIR)) {
  const ext = path.extname(filePath).toLowerCase();
  const expectedExtensions = EXTENSION_BY_KIND[detectImageKind(filePath)];
  if (!expectedExtensions || expectedExtensions.has(ext)) {
    continue;
  }

  errors.push(
    `${path.relative(process.cwd(), filePath)} contains ${Array.from(expectedExtensions).join('/')} data but is named ${ext}`
  );
}

if (errors.length > 0) {
  console.error(`Image extension check found ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('Image extension check passed.');
