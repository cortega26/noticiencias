/**
 * check-search-budget.test.ts
 *
 * Integration tests for the search artifact budget validator (plan 039,
 * wired up in plan 060 phase 1). Runs the CLI script against a fixture
 * `dist/search.json` built in a temp directory, asserting on exit code and
 * message content — same pattern as tests/contract-sync.test.ts.
 */

import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, it, expect, afterEach } from 'vitest';

const SCRIPT = resolve('scripts/check-search-budget.js');

function runCheck(distPath: string): {
  stdout: string;
  stderr: string;
  combined: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(`node ${SCRIPT} ${distPath}`, {
      cwd: resolve('.'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20_000,
    });
    return { stdout, stderr: '', combined: stdout, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    return {
      stdout,
      stderr,
      combined: stdout + stderr,
      exitCode: err.status ?? 1,
    };
  }
}

describe('check-search-budget', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes for a small, valid search.json well under the ceiling', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'search-budget-pass-'));
    tempDirs.push(distDir);

    const artifact = {
      version: 1,
      index: { fields: ['title', 'excerpt'] },
      store: {
        'https://noticiencias.example/posts/post-1': {
          title: 'Post 1',
          excerpt: 'A short excerpt for the first post.',
        },
        'https://noticiencias.example/posts/post-2': {
          title: 'Post 2',
          excerpt: 'A short excerpt for the second post.',
        },
        'https://noticiencias.example/posts/post-3': {
          title: 'Post 3',
          excerpt: 'A short excerpt for the third post.',
        },
      },
    };
    writeFileSync(join(distDir, 'search.json'), JSON.stringify(artifact), 'utf-8');

    const result = runCheck(distDir);
    expect(result.exitCode).toBe(0);
    expect(result.combined).toContain('✅ search artifact is valid');
  });

  it('fails when gzip size exceeds the 150KB ceiling (not the bloat heuristic)', () => {
    const distDir = mkdtempSync(join(tmpdir(), 'search-budget-oversized-'));
    tempDirs.push(distDir);

    // Build many entries (well over the bloat heuristic's `urls.length < 10`
    // threshold) each with a chunk of high-entropy, poorly-compressing text
    // (random bytes, not repetitive), so the fixture crosses the gzip
    // ceiling on its own merits without ever tripping the "suspiciously few
    // entries for this much raw size" bloat guard.
    const ENTRY_COUNT = 20;
    const store: Record<string, { title: string; excerpt: string }> = {};
    for (let i = 0; i < ENTRY_COUNT; i++) {
      store[`https://noticiencias.example/posts/post-${i}`] = {
        title: `Post ${i}`,
        // Random base64 text compresses poorly compared to natural-language
        // or repetitive text — ~14.7KB of high-entropy text per entry.
        excerpt: randomBytes(11 * 1024).toString('base64'),
      };
    }
    const artifact = {
      version: 1,
      index: { fields: ['title', 'excerpt'] },
      store,
    };
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'search.json'), JSON.stringify(artifact), 'utf-8');

    const result = runCheck(distDir);
    expect(result.exitCode).toBe(1);
    expect(result.combined).toContain('exceeds');
    expect(result.combined).toContain('ceiling');
    // Guard against a false pass: confirm this failed for the gzip-ceiling
    // reason, not the unrelated bloat-heuristic message.
    expect(result.combined).not.toContain('bloated fixture');
  });
});
