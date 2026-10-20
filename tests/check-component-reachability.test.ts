/**
 * check-component-reachability.test.ts
 *
 * CLI tests for scripts/check-component-reachability.js (plan 181). The
 * checker resolves roots, components, and the allowlist from process.cwd(),
 * so every test runs it inside a throwaway fixture repo.
 *
 * The allowlist is optional and must be written as repo-relative POSIX paths
 * (a leading "./" or Windows separators are normalized). An allowlist entry
 * that does not name an unreachable component must never hide it.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/check-component-reachability.js');

interface RunResult {
  combined: string;
  exitCode: number;
}

function runChecker(cwd: string): RunResult {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
    });
    return { combined: stdout, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number | null };
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    return { combined: stdout + stderr, exitCode: err.status ?? 1 };
  }
}

function makeFixture(extraFiles: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'component-reachability-'));
  const files: Record<string, string> = {
    'src/pages/index.astro': '---\n---\n<p>home</p>\n',
    'src/components/Orphan.astro': '---\n---\n<div>orphan</div>\n',
    'src/components/Nested/Deep.astro': '---\n---\n<div>deep</div>\n',
    ...extraFiles,
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(root, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return root;
}

describe('check-component-reachability', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when unreachable components are neither imported nor allowlisted', () => {
    const root = makeFixture();
    tempDirs.push(root);

    const { combined, exitCode } = runChecker(root);

    expect(exitCode).toBe(1);
    expect(combined).toContain('2 unreachable component(s)');
    expect(combined).toContain('src/components/Orphan.astro');
    expect(combined).toContain('src/components/Nested/Deep.astro');
  });

  it('honors a repo-relative allowlist entry', () => {
    const root = makeFixture({
      '.component-reachability-allowlist.json': JSON.stringify([
        'src/components/Orphan.astro',
        'src/components/Nested/Deep.astro',
      ]),
    });
    tempDirs.push(root);

    const { combined, exitCode } = runChecker(root);

    expect(combined).toContain('All components are reachable');
    expect(exitCode).toBe(0);
  });

  it('normalizes a leading ./ in allowlist entries', () => {
    const root = makeFixture({
      '.component-reachability-allowlist.json': JSON.stringify([
        './src/components/Orphan.astro',
        './src/components/Nested/Deep.astro',
      ]),
    });
    tempDirs.push(root);

    expect(runChecker(root).exitCode).toBe(0);
  });

  it('normalizes Windows separators in allowlist entries', () => {
    const root = makeFixture({
      '.component-reachability-allowlist.json': JSON.stringify([
        'src\\components\\Orphan.astro',
        'src\\components\\Nested\\Deep.astro',
      ]),
    });
    tempDirs.push(root);

    expect(runChecker(root).exitCode).toBe(0);
  });

  it('fails when the allowlist names a different component', () => {
    const root = makeFixture({
      '.component-reachability-allowlist.json': JSON.stringify(['src/components/NotHere.astro']),
    });
    tempDirs.push(root);

    const { combined, exitCode } = runChecker(root);

    expect(exitCode).toBe(1);
    expect(combined).toContain('src/components/Orphan.astro');
    expect(combined).toContain('src/components/Nested/Deep.astro');
  });

  it('still accepts absolute allowlist entries', () => {
    const root = makeFixture();
    tempDirs.push(root);
    writeFileSync(
      join(root, '.component-reachability-allowlist.json'),
      JSON.stringify([
        join(root, 'src/components/Orphan.astro'),
        join(root, 'src/components/Nested/Deep.astro'),
      ])
    );

    expect(runChecker(root).exitCode).toBe(0);
  });
});
