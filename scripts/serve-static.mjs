#!/usr/bin/env node
/**
 * Minimal static file server for a built directory (plan 009).
 *
 * `astro preview` daemonizes in this project and always serves `dist/`, so the
 * GA-enabled e2e fixture (built into `dist-consent/`) needs its own foreground
 * server. Usage: node scripts/serve-static.mjs <dir> <port>
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist-consent');
const port = Number(process.argv[3] ?? 4322);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(root, clean);
  if (!candidate.startsWith(root)) return null;
  for (const path of [candidate, join(candidate, 'index.html')]) {
    try {
      if ((await stat(path)).isFile()) return path;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res
    .writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    .end(await readFile(file));
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
