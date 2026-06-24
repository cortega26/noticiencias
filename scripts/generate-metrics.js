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
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(REPO_ROOT, 'src', 'content', 'posts');
const METRICS_DIR = resolve(REPO_ROOT, 'data', 'metrics');
const METRICS_FILE = resolve(METRICS_DIR, 'pipeline-metrics.json');
const IMAGE_DELIVERY_FILE = resolve(REPO_ROOT, 'data', 'image-delivery-mode.json');
const DERIVATIVES_MANIFEST = resolve(REPO_ROOT, 'data', 'image-derivatives-manifest.json');

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
      slug: basename(file, path.extname(file)),
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
// Main
// ---------------------------------------------------------------------------

function main() {
  const content = collectContentMetrics();
  const pipeline = collectPipelineMetrics();
  const images = collectImageMetrics();

  const report = {
    generated_at: new Date().toISOString(),
    content,
    pipeline,
    images,
  };

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
}

main();
