/**
 * check-doc-drift.test.ts
 *
 * Regression tests for scripts/check-doc-drift.js, focused on the
 * authority-order reference check (a claim that a file is "authoritative"
 * or "governs" a subject must reference existing files, and no two
 * documents may claim authority over the same subject).
 *
 * The script resolves docs relative to DOC_DRIFT_ROOT, so the tests run it
 * against fixture doc trees instead of the live repo docs.
 */

import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/check-doc-drift.js');
const FIXTURES = resolve('tests/fixtures/doc-drift');

function runCheck(
  root: string,
  docs: string[],
  siblingRoot?: string
): {
  combined: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(`node ${SCRIPT}`, {
      cwd: resolve('.'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
      env: {
        ...process.env,
        DOC_DRIFT_ROOT: root,
        DOC_DRIFT_FILES: docs.join(','),
        ...(siblingRoot ? { DOC_DRIFT_SIBLING_ROOT: siblingRoot } : {}),
      },
    });
    return { combined: stdout, exitCode: 0 };
  } catch (e: unknown) {
    const execError = e as {
      stdout?: { toString(): string } | string;
      stderr?: { toString(): string } | string;
      status?: number | null;
    };
    const stdout = execError.stdout?.toString() || '';
    const stderr = execError.stderr?.toString() || '';
    return { combined: stdout + stderr, exitCode: execError.status || 1 };
  }
}

describe('check-doc-drift authority-order references', () => {
  it('passes when authority claims resolve and agree', () => {
    const { combined, exitCode } = runCheck(join(FIXTURES, 'valid'), ['README.md', 'AGENTS.md']);
    expect(combined).toContain('[check:doc-drift] OK');
    expect(exitCode).toBe(0);
  });

  it('flags an authority claim that points at a missing doc', () => {
    const { combined, exitCode } = runCheck(join(FIXTURES, 'broken'), ['README.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('broken authority reference');
    expect(combined).toContain('GOVERNANCE.md');
  });

  it('flags two docs claiming authority over the same subject', () => {
    const { combined, exitCode } = runCheck(join(FIXTURES, 'conflict'), ['README.md', 'AGENTS.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('conflicting authority claim');
    expect(combined).toContain('post schema');
    expect(combined).toContain('agent and reviewer behavior');
  });

  it('passes against the live governance docs', () => {
    const { combined, exitCode } = runCheck(resolve('.'), []);
    expect(combined).toContain('[check:doc-drift] OK');
    expect(exitCode).toBe(0);
  });
});

describe('check-doc-drift declared invariants', () => {
  const staleRoot = join(FIXTURES, 'stale');

  it('flags the stale pre-split schema path with the expected value', () => {
    const { combined, exitCode } = runCheck(staleRoot, ['README.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('stale declared claim');
    expect(combined).toContain('src/content/config.ts');
    expect(combined).toContain('src/content.config.ts');
  });

  it('flags the stale site host with the value parsed from site config', () => {
    const { combined, exitCode } = runCheck(staleRoot, ['README.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('noticiencias.cl');
    expect(combined).toContain('https://noticiencias.com (parsed from site config)');
  });

  it('flags a stale "static Astro N site" claim with the installed major', () => {
    const { combined, exitCode } = runCheck(staleRoot, ['README.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('static Astro 6 site');
    expect(combined).toMatch(/expected Astro \d+ \(parsed from package.json/);
  });

  it('flags a stale Node major claim with the engines major', () => {
    const { combined, exitCode } = runCheck(staleRoot, ['README.md']);
    expect(exitCode).toBe(1);
    expect(combined).toContain('Node 20');
    expect(combined).toMatch(/expected Node \d+ \(parsed from package\.json engines\.node\)/);
  });
});

describe('check-doc-drift cross-repo references', () => {
  const siblingRoot = (name: string) => join(FIXTURES, name, '_sibling');

  it('passes when a sibling reference resolves', () => {
    const { combined, exitCode } = runCheck(
      join(FIXTURES, 'sibling-ok'),
      ['README.md'],
      siblingRoot('sibling-ok')
    );
    expect(combined).toContain('[check:doc-drift] OK');
    expect(exitCode).toBe(0);
  });

  it('flags a sibling reference to a missing file', () => {
    const { combined, exitCode } = runCheck(
      join(FIXTURES, 'sibling-broken'),
      ['README.md'],
      siblingRoot('sibling-broken')
    );
    expect(exitCode).toBe(1);
    expect(combined).toContain('broken path');
    expect(combined).toContain('MISSING.md');
  });

  it('skips sibling references when the sibling is not checked out', () => {
    const { combined, exitCode } = runCheck(
      join(FIXTURES, 'sibling-broken'),
      ['README.md'],
      join(FIXTURES, 'no-such-sibling')
    );
    expect(combined).toContain('[check:doc-drift] OK');
    expect(exitCode).toBe(0);
  });
});
