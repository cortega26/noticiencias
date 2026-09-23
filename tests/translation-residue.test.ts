/**
 * translation-residue.test.ts
 *
 * Regression tests for scripts/check-translation-residue.js, pinned to the
 * real PR #197 catches (`descoberta`, `youth` shipped to Spanish readers).
 * Runs the script against fixture post trees via its positional dir arg
 * instead of the live corpus.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/check-translation-residue.js');
const MIXED = resolve('tests/fixtures/translation-residue/mixed');
const CLEAN = resolve('tests/fixtures/translation-residue/clean');

function runCheck(dir: string): { combined: string; exitCode: number } {
  // execFileSync (no shell) instead of execSync with interpolation: removes
  // the command-injection surface entirely rather than relying on the args
  // being constants today.
  try {
    const stdout = execFileSync('node', [SCRIPT, dir], {
      cwd: resolve('.'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20_000,
    });
    return { combined: stdout, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    return { combined: stdout + stderr, exitCode: err.status ?? 1 };
  }
}

describe('check-translation-residue', () => {
  it('fails on Portuguese residue (PR #197 descoberta class)', () => {
    const result = runCheck(MIXED);
    expect(result.exitCode).toBe(1);
    expect(result.combined).toContain('descoberta');
  });

  it('warns (no fail) on English suspects without Portuguese residue', () => {
    // Mixed dir has both; assert the EN tier surfaces as warning text.
    const result = runCheck(MIXED);
    expect(result.combined).toContain('youth');
  });

  it('passes proper names (São Paulo, Schrödinger, pingüino)', () => {
    const result = runCheck(CLEAN);
    expect(result.exitCode).toBe(0);
    expect(result.combined).toContain('no residue');
  });
});
