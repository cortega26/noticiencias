import { describe, expect, it } from 'vitest';
import { parseCliFlags, resolveMode } from '../../scripts/social/publish.js';

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
