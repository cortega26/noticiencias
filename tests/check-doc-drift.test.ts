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
  docs: string[]
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
      },
    });
    return { combined: stdout, exitCode: 0 };
  } catch (e: any) {
    const stdout = e.stdout?.toString() || '';
    const stderr = e.stderr?.toString() || '';
    return { combined: stdout + stderr, exitCode: e.status || 1 };
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
