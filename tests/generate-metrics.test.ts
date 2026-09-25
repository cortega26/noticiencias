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

import { execFile, execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'node:http';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const SCRIPT = resolve('scripts/generate-metrics.js');

function runGenerator(root: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync(process.execPath, [SCRIPT], {
    env: { ...process.env, METRICS_ROOT: root, ...extraEnv },
    encoding: 'utf-8',
    timeout: 30_000,
  });
}

function runGeneratorAsync(root: string, extraEnv: Record<string, string> = {}): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      process.execPath,
      [SCRIPT],
      {
        env: { ...process.env, METRICS_ROOT: root, ...extraEnv },
        encoding: 'utf-8',
        timeout: 30_000,
      },
      (error, stdout) => {
        if (error) rejectPromise(error);
        else resolvePromise(stdout);
      }
    );
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
    'image: https://example.com/hero.jpg',
    'image_alt: Descripción de prueba',
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

interface MetricsSnapshot {
  generated_at: string;
  pipeline: { generated_at: string };
  content: { total_articles: number };
  [key: string]: unknown;
}

function readMetrics(root: string): MetricsSnapshot {
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

interface HealthSection {
  status: string;
  detail?: string;
  evidence?: string;
  counts?: Record<string, number>;
  errors?: number;
  oldest_pending_age_seconds?: number;
}

function readHealth(root: string): Record<string, HealthSection> {
  return readMetrics(root).health as Record<string, HealthSection>;
}

async function withJsonServer<T>(payload: unknown, run: (url: string) => Promise<T>): Promise<T> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(payload));
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return await run(`http://127.0.0.1:${port}/v1/admin/dashboard/health`);
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  return port;
}

describe('generate-metrics health section (plan 060 Phase 5d)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'noticiencias-health-'));
    mkdirSync(join(root, 'src', 'content', 'posts'), { recursive: true });
    mkdirSync(join(root, 'data', 'metrics'), { recursive: true });
    writePost(root, 'science-1.md');
    writePost(root, 'tech-1.md', { title: 'Tech post', categories: '[Tecnología]' });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('marks unmeasured checks unknown and measures local records', () => {
    runGenerator(root);

    const health = readHealth(root);
    expect(health.schema.status).toBe('unknown');
    expect(health.lint.status).toBe('unknown');
    expect(health.callbacks.status).toBe('unknown');
    expect(health.publication.status).toBe('unknown');
    expect(health.validation.status).toBe('unknown');
    expect(health.derivatives.status).toBe('unknown');
    expect(health.hero_images.status).toBe('pass');
    expect(health.editorial.status).toBe('pass');
  });

  it('warns when a post has no hero image', () => {
    writePost(root, 'no-image.md', { title: 'No image post', image: '' });

    runGenerator(root);

    const health = readHealth(root);
    expect(health.hero_images.status).toBe('warning');
    expect(health.hero_images.errors).toBe(1);
    expect(health.hero_images.detail).toContain('missing');
  });

  it('marks hero health unknown when there are no posts', () => {
    rmSync(join(root, 'src', 'content', 'posts', 'science-1.md'));
    rmSync(join(root, 'src', 'content', 'posts', 'tech-1.md'));

    runGenerator(root);

    expect(readHealth(root).hero_images.status).toBe('unknown');
  });

  it('maps the lint artifact when provided', () => {
    const artifact = join(root, 'check-results.json');
    writeFileSync(artifact, JSON.stringify({ lint: { status: 'fail' } }), 'utf-8');

    runGenerator(root, { CHECK_RESULTS_PATH: artifact });

    expect(readHealth(root).lint.status).toBe('fail');
  });

  it('maps backend health when configured', async () => {
    const payload = {
      generated_at: new Date().toISOString(),
      publication: {
        status: 'warning',
        evidence: 'present',
        detail: 'stale PR_CREATED',
        oldest_pending_age_seconds: 7200,
        counts: { PUBLISHING: 0, PR_CREATED: 1, REJECTED: 0, COMPLETED: 4 },
      },
      callbacks: {
        status: 'fail',
        evidence: 'present',
        detail: 'failed receipt',
        oldest_pending_age_seconds: 60,
        counts: { received: 0, processed: 3, failed: 1 },
      },
      validation: {
        status: 'pass',
        evidence: 'present',
        detail: 'checks ok',
        counts: { check_passed: 2, rejected: 0 },
      },
    };

    await withJsonServer(payload, (url) =>
      runGeneratorAsync(root, { BACKEND_ADMIN_URL: url, BACKEND_ADMIN_TOKEN: 'token' })
    );

    const health = readHealth(root);
    expect(health.publication.status).toBe('warning');
    expect(health.publication.counts).toEqual({
      PUBLISHING: 0,
      PR_CREATED: 1,
      REJECTED: 0,
      COMPLETED: 4,
    });
    // Ages must not be copied into the committed metrics (no-churn).
    expect(health.publication.oldest_pending_age_seconds).toBeUndefined();
    expect(health.callbacks.status).toBe('fail');
    expect(health.callbacks.counts).toEqual({ received: 0, processed: 3, failed: 1 });
    expect(health.validation.status).toBe('pass');
  });

  it('marks backend health unknown when the endpoint is unreachable', async () => {
    const port = await freePort();

    await runGeneratorAsync(root, {
      BACKEND_ADMIN_URL: `http://127.0.0.1:${port}/v1/admin/dashboard/health`,
      BACKEND_ADMIN_TOKEN: 'token',
    });

    const health = readHealth(root);
    expect(health.callbacks.status).toBe('unknown');
    expect(health.publication.status).toBe('unknown');
    expect(health.validation.status).toBe('unknown');
  });

  it('maps backend evidence "none" to unknown even with a pass status', async () => {
    await withJsonServer(
      {
        publication: { status: 'pass', evidence: 'none', counts: {} },
        callbacks: { status: 'pass', evidence: 'none', counts: {} },
        validation: { status: 'pass', evidence: 'none', counts: {} },
      },
      (url) => runGeneratorAsync(root, { BACKEND_ADMIN_URL: url, BACKEND_ADMIN_TOKEN: 't' })
    );

    const health = readHealth(root);
    expect(health.publication.status).toBe('unknown');
    expect(health.callbacks.status).toBe('unknown');
    expect(health.validation.status).toBe('unknown');
  });
});
