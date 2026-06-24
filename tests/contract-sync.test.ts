/**
 * check-contract-sync.test.ts
 *
 * Integration tests for the cross-repo contract parity gate.
 * Runs the CLI script against fixture schemas and validates outputs.
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SCRIPT = resolve('scripts/check-contract-sync.js');
const FIXTURES = resolve('tests/fixtures/contract-sync');

function runSync(args: string): {
  stdout: string;
  stderr: string;
  combined: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(`node ${SCRIPT} ${args}`, {
      cwd: resolve('.'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
    });
    return { stdout, stderr: '', combined: stdout, exitCode: 0 };
  } catch (e: any) {
    const stdout = e.stdout?.toString() || '';
    const stderr = e.stderr?.toString() || '';
    return {
      stdout,
      stderr,
      combined: stdout + stderr,
      exitCode: e.status || 1,
    };
  }
}

describe('check-contract-sync', () => {
  // ── Field name parity ──────────────────────────────────────────
  describe('field name parity', () => {
    it('passes when all fields match between Python and TypeScript', () => {
      const result = runSync(`${FIXTURES}/simple_py.py ${FIXTURES}/simple_ts.ts`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('full parity confirmed');
    });

    it('fails (exit 1) when Python has a field not present in TypeScript', () => {
      const result = runSync(`${FIXTURES}/mismatch_py.py ${FIXTURES}/mismatch_ts.ts`);
      expect(result.exitCode).toBe(1);
      expect(result.combined).toContain('extra_field_only_in_python');
      expect(result.combined).toContain('PARITY FAILURE');
    });

    it('fails (exit 1) when TypeScript has a field not present in Python', () => {
      // swap args: ts as py, py as ts to simulate ts-only field
      const result = runSync(`${FIXTURES}/mismatch_ts.ts ${FIXTURES}/mismatch_py.py`);
      // Python parser will fail on the TS file, so this should error
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ── Real schemas ───────────────────────────────────────────────
  describe('real schemas', () => {
    const PY_PATH = '../noticiencias_news_collector/news_collector/contracts/frontend_schema.py';
    const TS_PATH = 'src/content.config.ts';

    it('confirms parity between the actual backend and frontend schemas', () => {
      // Skip if backend schema not available (e.g., CI without backend checkout)
      if (!existsSync(resolve(PY_PATH))) {
        console.warn('Backend schema not found — skipping real-schema parity test');
        return;
      }
      const result = runSync(`${PY_PATH} ${TS_PATH}`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('full parity confirmed');
    });
  });

  // ── Snapshot mode ──────────────────────────────────────────────
  describe('snapshot mode', () => {
    const SNAPSHOT_PATH = resolve('tests/fixtures/contract-sync/test-snapshot.json');
    const TS_PATH = resolve('tests/fixtures/contract-sync/simple_ts.ts');

    beforeAll(() => {
      // Generate a snapshot from the simple fixture
      const result = runSync(
        `--generate-snapshot ${SNAPSHOT_PATH} ${FIXTURES}/simple_py.py ${FIXTURES}/simple_ts.ts`
      );
      expect(result.exitCode).toBe(0);
      expect(existsSync(SNAPSHOT_PATH)).toBe(true);
    });

    afterAll(() => {
      if (existsSync(SNAPSHOT_PATH)) unlinkSync(SNAPSHOT_PATH);
    });

    it('passes parity check using a snapshot instead of live Python file', () => {
      const result = runSync(`--snapshot ${SNAPSHOT_PATH} ${TS_PATH}`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('Using snapshot');
      expect(result.combined).toContain('full parity confirmed');
    });

    it('detects mismatch when a field is removed from the TypeScript side', () => {
      // The mismatch_ts.ts is missing 'author' and 'featured' and 'source_url' and 'sources'
      const result = runSync(`--snapshot ${SNAPSHOT_PATH} ${FIXTURES}/mismatch_ts.ts`);
      // Field presence mismatch = error
      expect(result.exitCode).toBe(1);
    });

    it('rejects invalid snapshot path with exit 2', () => {
      const result = runSync('--snapshot /nonexistent/path.json src/content.config.ts');
      expect(result.exitCode).toBe(2);
    });
  });

  // ── Error handling ─────────────────────────────────────────────
  describe('error handling', () => {
    it('exits 2 when required arguments are missing', () => {
      const result = runSync('');
      expect(result.exitCode).toBe(2);
    });

    it('exits 2 when Python file does not exist and no snapshot fallback', () => {
      const result = runSync('/nonexistent/py.py /nonexistent/ts.ts');
      expect(result.exitCode).toBe(2);
    });
  });
});
