#!/usr/bin/env node
/**
 * generate-metrics.js
 *
 * Generates content pipeline metrics as JSON for the admin dashboard.
 * Output: data/metrics/pipeline-metrics.json
 *
 * Usage:
 *   node scripts/generate-metrics.js
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from './utils/frontmatter-parser.js';
import { collectHeroImageDiagnostics } from './utils/hero-placeholders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// METRICS_ROOT override is used by the test suite to run against a temp
// fixture tree instead of the repository itself.
const REPO_ROOT = process.env.METRICS_ROOT
  ? resolve(process.env.METRICS_ROOT)
  : resolve(__dirname, '..');
const POSTS_DIR = resolve(REPO_ROOT, 'src', 'content', 'posts');
const METRICS_DIR = resolve(REPO_ROOT, 'data', 'metrics');
const METRICS_FILE = resolve(METRICS_DIR, 'pipeline-metrics.json');
const IMAGE_DELIVERY_FILE = resolve(REPO_ROOT, 'data', 'image-delivery-mode.json');
const DERIVATIVES_MANIFEST = resolve(REPO_ROOT, 'data', 'image-derivatives-manifest.json');
const CONTRACT_CHECKER = resolve(REPO_ROOT, 'scripts', 'check-contract-sync.js');
const CONTRACT_SNAPSHOT = resolve(
  REPO_ROOT,
  '.contract-snapshots',
  'frontend_schema.snapshot.json'
);
const CONTENT_CONFIG = resolve(REPO_ROOT, 'src', 'content.config.ts');

// ---------------------------------------------------------------------------
// Content metrics
// ---------------------------------------------------------------------------

function collectContentMetrics() {
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

  const articles = [];
  const categories = {};
  const tags = {};
  const editorialGaps = {
    missing_summary_points: 0,
    missing_glossary: 0,
    missing_fact_check: 0,
    missing_why_it_matters: 0,
    missing_confidence: 0,
    missing_sources: 0,
  };
  let v2Count = 0;
  let totalWords = 0;

  for (const file of files) {
    const filePath = resolve(POSTS_DIR, file);
    let content, fm;
    try {
      content = readFileSync(filePath, 'utf-8');
      const parsed = matter(content);
      fm = parsed.data;
      const wordCount = parsed.content.split(/\s+/).filter((w) => w.length > 0).length;
      totalWords += wordCount;
    } catch {
      continue;
    }

    // Categories
    if (Array.isArray(fm.categories)) {
      for (const cat of fm.categories) {
        categories[cat] = (categories[cat] || 0) + 1;
      }
    }

    // Tags
    if (Array.isArray(fm.tags)) {
      for (const tag of fm.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }

    // Editorial fields (only for v2)
    if (fm.schema_version && fm.schema_version >= 2) {
      v2Count++;
      if (!fm.summary_points || fm.summary_points.length === 0)
        editorialGaps.missing_summary_points++;
      if (!fm.glossary || fm.glossary.length === 0) editorialGaps.missing_glossary++;
      if (!fm.fact_check || fm.fact_check.length === 0) editorialGaps.missing_fact_check++;
      if (!fm.why_it_matters || fm.why_it_matters.length === 0)
        editorialGaps.missing_why_it_matters++;
      if (!fm.confidence) editorialGaps.missing_confidence++;
      if (!fm.sources || fm.sources.length === 0) editorialGaps.missing_sources++;
    }

    articles.push({
      slug: basename(file, extname(file)),
      title: fm.title || 'Sin título',
      date: fm.date ? new Date(fm.date).toISOString().slice(0, 10) : null,
      categories: fm.categories || [],
      schema_version: fm.schema_version || 1,
      editorial_score: fm.editorial_score || null,
      confidence: fm.confidence || null,
      review_status: fm.review_status || null,
    });
  }

  // Sort categories and tags by frequency
  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));

  const sortedTags = Object.entries(tags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30) // Top 30
    .map(([name, count]) => ({ name, count }));

  return {
    total_articles: files.length,
    v2_articles: v2Count,
    total_words: totalWords,
    avg_words: files.length > 0 ? Math.round(totalWords / files.length) : 0,
    categories: sortedCategories,
    top_tags: sortedTags,
    articles_by_date: articles.filter((a) => a.date).sort((a, b) => b.date.localeCompare(a.date)),
    editorial_gaps: editorialGaps,
    articles_with_gaps:
      editorialGaps.missing_summary_points +
        editorialGaps.missing_glossary +
        editorialGaps.missing_fact_check +
        editorialGaps.missing_why_it_matters +
        editorialGaps.missing_confidence +
        editorialGaps.missing_sources >
      0
        ? v2Count
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Pipeline metrics
// ---------------------------------------------------------------------------

function collectPipelineMetrics() {
  // Read checks from pre-publish diagnostics if available
  let lastValidation = null;
  try {
    const diagFile = resolve(REPO_ROOT, 'data', 'pre-publish-diagnostics.json');
    if (existsSync(diagFile)) {
      const raw = readFileSync(diagFile, 'utf-8');
      lastValidation = JSON.parse(raw);
    }
  } catch {
    // No diagnostics available yet
  }

  return {
    last_validation: lastValidation,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Image metrics
// ---------------------------------------------------------------------------

function collectImageMetrics() {
  let deliveryMode = 'github';
  try {
    if (existsSync(IMAGE_DELIVERY_FILE)) {
      const raw = readFileSync(IMAGE_DELIVERY_FILE, 'utf-8');
      const config = JSON.parse(raw);
      deliveryMode = config.mode || 'github';
    }
  } catch {
    // Default
  }

  let derivativesCount = 0;
  let missingDerivatives = 0;
  try {
    if (existsSync(DERIVATIVES_MANIFEST)) {
      const raw = readFileSync(DERIVATIVES_MANIFEST, 'utf-8');
      const manifest = JSON.parse(raw);
      derivativesCount = Object.keys(manifest.images || manifest || {}).length;
    }
  } catch {
    // Not available
  }

  return {
    delivery_mode: deliveryMode,
    derivatives_available: derivativesCount,
    missing_derivatives: missingDerivatives,
  };
}

// ---------------------------------------------------------------------------
// Health metrics (plan 060 Phase 5d)
// ---------------------------------------------------------------------------
//
// Every check below is derived from a real record. When the record is not
// available (no snapshot, no lint artifact, no backend credentials), the
// check is `unknown` — never `pass`. The backend sections are fetched from
// `GET /v1/admin/dashboard/health` (plan 060 Phase 5c), which itself reports
// `evidence: "none"` for areas with no durable records. Relative ages are
// deliberately not copied: they would change every run and break the
// no-churn contract below.

const HEALTH_STATUSES = new Set(['pass', 'warning', 'fail', 'unknown']);

function boundedDetail(value, limit = 240) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function unknownHealth(detail) {
  return { status: 'unknown', detail };
}

function collectSchemaHealth() {
  if (
    !existsSync(CONTRACT_CHECKER) ||
    !existsSync(CONTRACT_SNAPSHOT) ||
    !existsSync(CONTENT_CONFIG)
  ) {
    return unknownHealth('Snapshot de contrato no disponible.');
  }
  const result = spawnSync(
    process.execPath,
    [CONTRACT_CHECKER, '--snapshot', CONTRACT_SNAPSHOT, CONTENT_CONFIG],
    { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 30_000 }
  );
  if (result.status === 0) {
    return { status: 'pass', detail: 'Paridad con el snapshot de esquema.' };
  }
  if (result.status === 1) {
    return {
      status: 'fail',
      detail: boundedDetail(result.stderr || result.stdout) || 'Paridad de esquema rota.',
    };
  }
  return unknownHealth('No se pudo ejecutar la verificación de esquema.');
}

function collectEditorialHealth(content) {
  const gaps = content?.editorial_gaps ?? {};
  if (!content || !content.v2_articles) {
    return unknownHealth('Sin artículos v2 para evaluar.');
  }
  const missing = Object.entries(gaps)
    .filter(([, value]) => value > 0)
    .map(([key]) => key.replace('missing_', ''));
  if (missing.length > 0) {
    return { status: 'warning', detail: `Faltantes: ${missing.join(', ')}` };
  }
  return {
    status: 'pass',
    detail: `${content.v2_articles} artículos v2 completos.`,
  };
}

function collectHeroHealth() {
  let diagnostics;
  try {
    diagnostics = collectHeroImageDiagnostics({ repoRoot: REPO_ROOT });
  } catch {
    return { ...unknownHealth('No se pudo evaluar imágenes hero.'), errors: 0 };
  }
  if (!diagnostics.filesCount) {
    return { ...unknownHealth('Sin artículos para evaluar.'), errors: 0 };
  }
  if (diagnostics.errors.length > 0) {
    return {
      status: 'warning',
      detail: `${diagnostics.errors.length} problema(s): ${boundedDetail(diagnostics.errors[0])}`,
      errors: diagnostics.errors.length,
    };
  }
  return {
    status: 'pass',
    detail: `${diagnostics.filesCount} artículo(s) con imagen y alt.`,
    errors: 0,
  };
}

function collectDerivativesHealth(images) {
  if (!images || images.derivatives_available <= 0) {
    return unknownHealth('Sin manifiesto de derivados.');
  }
  if (images.missing_derivatives > 0) {
    return {
      status: 'warning',
      detail: `${images.missing_derivatives} derivativo(s) faltante(s).`,
    };
  }
  return {
    status: 'pass',
    detail: `${images.derivatives_available} derivativos disponibles.`,
  };
}

function readLintHealth() {
  const artifactPath = process.env.CHECK_RESULTS_PATH;
  if (!artifactPath) {
    return unknownHealth('Sin resultado de lint registrado.');
  }
  try {
    const report = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    const status = report?.lint?.status;
    if (status === 'pass' || status === 'fail') {
      return {
        status,
        detail:
          status === 'pass' ? 'ESLint + Prettier + checks OK.' : 'Lint con errores; revisar CI.',
      };
    }
  } catch {
    // fall through to unknown
  }
  return unknownHealth('Resultado de lint ilegible.');
}

function pickBackendSection(section) {
  const evidence = section?.evidence === 'present' ? 'present' : 'none';
  const detail = boundedDetail(section?.detail);
  const counts =
    section && typeof section.counts === 'object' && section.counts !== null
      ? Object.fromEntries(
          Object.entries(section.counts).map(([key, value]) => [key, Number(value) || 0])
        )
      : {};
  if (evidence !== 'present') {
    return { status: 'unknown', evidence: 'none', detail, counts };
  }
  const status = HEALTH_STATUSES.has(section?.status) ? section.status : 'unknown';
  return { status, evidence, detail, counts };
}

async function collectBackendHealth() {
  const url = process.env.BACKEND_ADMIN_URL;
  const token = process.env.BACKEND_ADMIN_TOKEN;
  if (!url || !token) {
    const detail = 'Backend sin configurar (BACKEND_ADMIN_URL/BACKEND_ADMIN_TOKEN).';
    return {
      callbacks: unknownHealth(detail),
      publication: unknownHealth(detail),
      validation: unknownHealth(detail),
    };
  }
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const detail = `Backend respondió ${response.status}.`;
      return {
        callbacks: unknownHealth(detail),
        publication: unknownHealth(detail),
        validation: unknownHealth(detail),
      };
    }
    const body = await response.json();
    return {
      callbacks: pickBackendSection(body?.callbacks),
      publication: pickBackendSection(body?.publication),
      validation: pickBackendSection(body?.validation),
    };
  } catch {
    const detail = 'No se pudo leer la salud del backend.';
    return {
      callbacks: unknownHealth(detail),
      publication: unknownHealth(detail),
      validation: unknownHealth(detail),
    };
  }
}

async function collectHealthMetrics({ content, images }) {
  const backend = await collectBackendHealth();
  return {
    schema: collectSchemaHealth(),
    editorial: collectEditorialHealth(content),
    hero_images: collectHeroHealth(),
    derivatives: collectDerivativesHealth(images),
    lint: readLintHealth(),
    callbacks: backend.callbacks,
    publication: backend.publication,
    validation: backend.validation,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Preserve the existing timestamps when the meaningful metrics are unchanged.
 *
 * The scheduled bot workflow skips the commit/PR via `git diff --cached
 * --quiet`; without this guard every daily run would rewrite generated_at and
 * open + auto-merge a "chore: update pipeline metrics" PR that only bumps the
 * timestamp. The output must be byte-identical to the committed file for the
 * diff to stay empty.
 */
function preserveTimestampsWhenUnchanged(report) {
  let existing;
  try {
    existing = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
  } catch {
    return;
  }

  const stripTimestamps = (r) =>
    JSON.parse(JSON.stringify(r, (key, value) => (key === 'generated_at' ? undefined : value)));

  if (JSON.stringify(stripTimestamps(existing)) !== JSON.stringify(stripTimestamps(report))) {
    return;
  }

  report.generated_at = existing.generated_at || report.generated_at;
  report.pipeline.generated_at = existing.pipeline?.generated_at || report.pipeline.generated_at;
}

async function main() {
  const content = collectContentMetrics();
  const pipeline = collectPipelineMetrics();
  const images = collectImageMetrics();
  const health = await collectHealthMetrics({ content, images });

  const report = {
    generated_at: new Date().toISOString(),
    content,
    pipeline,
    images,
    health,
  };

  preserveTimestampsWhenUnchanged(report);

  // Write metrics file
  mkdirSync(METRICS_DIR, { recursive: true });
  writeFileSync(METRICS_FILE, JSON.stringify(report, null, 2));

  console.log(`[metrics] Report written to ${METRICS_FILE}`);
  console.log(`[metrics] ${content.total_articles} articles, ${content.v2_articles} at v2`);
  console.log(
    `[metrics] Editorial gaps: ${
      Object.entries(content.editorial_gaps)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'none'
    }`
  );
  console.log(
    `[metrics] Image delivery: ${images.delivery_mode}, ${images.derivatives_available} derivatives`
  );
  console.log(
    `[metrics] Health: schema=${health.schema.status}, hero=${health.hero_images.status}, ` +
      `lint=${health.lint.status}, callbacks=${health.callbacks.status}, ` +
      `publication=${health.publication.status}`
  );
}

main().catch((error) => {
  console.error('[metrics] generation failed:', error);
  process.exitCode = 1;
});
