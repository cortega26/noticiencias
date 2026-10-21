import { describe, expect, it, vi } from 'vitest';
import { parseCliFlags, resolveMode, warnStateWriteFailed } from '../../scripts/social/publish.js';

/**
 * Regression tests for the CLI → mode wiring (social-distribution publish
 * path): the workflow's publish job runs `publish.js --execute` and must
 * reach `runDistribution` with `mode: 'publish'`. A previous revision mapped
 * `--execute` onto the default `'dry-run'` mode, so the gated publish job
 * silently performed zero mutations.
 *
 * Scope note: pure argv/mode mapping only — no network, no env, no ledger.
 */

describe('parseCliFlags', () => {
  it('defaults to a non-executing dry-run with all-platform selectors', () => {
    expect(parseCliFlags([])).toEqual({
      execute: false,
      mode: 'dry-run',
      articleId: '',
      platform: 'all',
    });
  });

  it('keeps --execute orthogonal to the mode field', () => {
    expect(parseCliFlags(['--execute'])).toMatchObject({
      execute: true,
      mode: 'dry-run',
    });
  });

  it('parses --reconcile, --article-id and --platform selectors', () => {
    expect(
      parseCliFlags(['--execute', '--reconcile', '--article-id', 'abc', '--platform', 'x'])
    ).toEqual({
      execute: true,
      mode: 'reconcile',
      articleId: 'abc',
      platform: 'x',
    });
  });

  it('ignores unknown flags without changing the mapping', () => {
    expect(parseCliFlags(['--frobnicate', '--execute'])).toMatchObject({
      execute: true,
    });
  });
});

describe('resolveMode', () => {
  it('maps bare --execute to publish (the workflow publish-job invocation)', () => {
    expect(resolveMode(parseCliFlags(['--execute']))).toBe('publish');
  });

  it('maps --execute --reconcile to reconcile', () => {
    expect(resolveMode(parseCliFlags(['--execute', '--reconcile']))).toBe('reconcile');
  });

  it('stays dry-run without --execute, even with --reconcile present', () => {
    expect(resolveMode(parseCliFlags([]))).toBe('dry-run');
    expect(resolveMode(parseCliFlags(['--reconcile']))).toBe('dry-run');
    expect(resolveMode(parseCliFlags(['--dry-run']))).toBe('dry-run');
  });

  it('treats a missing or malformed flags object as dry-run', () => {
    expect(resolveMode(undefined)).toBe('dry-run');
    expect(resolveMode({})).toBe('dry-run');
  });
});

describe('warnStateWriteFailed', () => {
  it('turns a swallowed ledger-write failure into a stderr warning annotation', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await Promise.reject(new Error('CAS conflict')).catch(
        warnStateWriteFailed('releaseUnsentReservation', 'soc-1', 'bluesky')
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(
        '::warning title=Social state write failed::releaseUnsentReservation for soc-1/bluesky: CAS conflict'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('escapes newlines and percent signs so a message cannot inject workflow commands', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      warnStateWriteFailed('recordResult', 'soc-2', 'x')(new Error('100%\n::error::injected'));
      const line = String(spy.mock.calls[0][0]);
      expect(line).not.toContain('\n');
      expect(line).toContain('100%25%0A::error::injected');
    } finally {
      spy.mockRestore();
    }
  });

  it('copes with non-Error rejections', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      warnStateWriteFailed('recordResult', 'soc-3', 'x')('plain string');
      expect(String(spy.mock.calls[0][0])).toContain('soc-3/x: plain string');
    } finally {
      spy.mockRestore();
    }
  });
});
