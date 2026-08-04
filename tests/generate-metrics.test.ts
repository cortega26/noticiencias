/**
 * generate-metrics.test.ts
 *
 * Regression tests for scripts/generate-metrics.js, focused on the no-churn
 * contract with the scheduled bot workflow: the output file must be
 * byte-identical on no-op re-runs (otherwise `git diff --cached --quiet` in
 * the workflow never triggers and the bot opens an auto-merging PR every day
 * that only bumps generated_at).
 *
 * Runs the script against a temp fixture tree via the METRICS_ROOT override.
 */

import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const SCRIPT = resolve('scripts/generate-metrics.js');

function runGenerator(root: string): string {
  return execFileSync(process.execPath, [SCRIPT], {
    env: { ...process.env, METRICS_ROOT: root },
    encoding: 'utf-8',
    timeout: 30_000,
  });
}

function metricsPath(root: string): string {
  return join(root, 'data', 'metrics', 'pipeline-metrics.json');
}

function writePost(root: string, name: string, overrides: Record<string, unknown> = {}) {
  const base = [
    '---',
    'title: Test post',
    'date: 2026-01-01',
    'categories: [Ciencia]',
    'tags: [fisica]',
    'schema_version: 2',
    'summary_points: [one]',
    'glossary: [{ term: a, definition: b }]',
    'fact_check: [{ claim: c, status: verified }]',
    'why_it_matters: reason',
    'confidence: 0.9',
    'sources: [{ title: s, url: https://example.com }]',
    '---',
    '',
    'Body text for the post.',
  ];
  for (const [key, value] of Object.entries(overrides)) {
    const idx = base.findIndex((l) => l.startsWith(`${key}:`));
    if (idx >= 0) base[idx] = `${key}: ${value}`;
    else base.splice(base.length - 2, 0, `${key}: ${value}`);
  }
  writeFileSync(join(root, 'src', 'content', 'posts', name), base.join('\n'), 'utf-8');
}

function readMetrics(root: string): Record<string, any> {
  return JSON.parse(readFileSync(metricsPath(root), 'utf-8'));
}

describe('generate-metrics no-churn contract', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'noticiencias-metrics-'));
    mkdirSync(join(root, 'src', 'content', 'posts'), { recursive: true });
    mkdirSync(join(root, 'data', 'metrics'), { recursive: true });
    writePost(root, 'science-1.md');
    writePost(root, 'tech-1.md', { title: 'Tech post', categories: '[Tecnología]' });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('produces byte-identical output on consecutive no-op runs', () => {
    runGenerator(root);
    const first = readFileSync(metricsPath(root), 'utf-8');
    runGenerator(root);
    const second = readFileSync(metricsPath(root), 'utf-8');
    expect(second).toBe(first);
  });

  it('preserves existing generated_at when the meaningful content is unchanged', () => {
    runGenerator(root);
    const metrics = readMetrics(root);
    const sentinel = '2000-01-01T00:00:00.000Z';
    metrics.generated_at = sentinel;
    metrics.pipeline.generated_at = sentinel;
    writeFileSync(metricsPath(root), JSON.stringify(metrics, null, 2), 'utf-8');

    runGenerator(root);

    const rerun = readMetrics(root);
    expect(rerun.generated_at).toBe(sentinel);
    expect(rerun.pipeline.generated_at).toBe(sentinel);
  });

  it('bumps generated_at when the content changes', () => {
    runGenerator(root);
    const first = readMetrics(root);

    writePost(root, 'health-1.md', { title: 'Health post', categories: '[Salud]' });
    runGenerator(root);
    const second = readMetrics(root);

    expect(second.content.total_articles).toBe(first.content.total_articles + 1);
    expect(second.generated_at).not.toBe(first.generated_at);
  });

  it('writes the metrics file on first run even when the directory is empty', () => {
    rmSync(join(root, 'src', 'content', 'posts', 'science-1.md'));
    rmSync(join(root, 'src', 'content', 'posts', 'tech-1.md'));
    runGenerator(root);
    expect(existsSync(metricsPath(root))).toBe(true);
    expect(readMetrics(root).content.total_articles).toBe(0);
  });
});
