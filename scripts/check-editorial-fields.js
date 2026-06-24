/**
 * Validates editorial completeness for posts with schema_version >= 2.
 *
 * Schema v2 requires structured editorial enrichment fields:
 *   - summary_points (2-5 items)
 *   - glossary (≥1 item)
 *   - fact_check (≥1 item)
 *   - why_it_matters (≥1 item)
 *   - confidence (present)
 *   - sources (≥1 item)
 *
 * Schema v1 posts are skipped — this is a progressive enforcement mechanism.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { globSync } from 'glob';

const CONTENT_DIR = path.resolve('src/content/posts');
const MIN_SUMMARY_POINTS = 2;
const MAX_SUMMARY_POINTS = 5;
const MIN_GLOSSARY_ITEMS = 1;
const MIN_FACT_CHECK_ITEMS = 1;
const MIN_WHY_IT_MATTERS_ITEMS = 1;
const MIN_SOURCES = 1;

function collectEditorialDiagnostics() {
  const files = globSync('*.md', { cwd: CONTENT_DIR, absolute: true });
  const diagnostics = { errors: [], warnings: [], filesCount: files.length, v2Count: 0 };

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: fm } = matter(raw);
    const slug = path.basename(filePath);

    // Only enforce for schema_version >= 2
    if (!fm.schema_version || fm.schema_version < 2) {
      continue;
    }

    diagnostics.v2Count++;

    // summary_points
    if (!fm.summary_points) {
      diagnostics.errors.push(`${slug}: falta summary_points (requerido para schema_version >= 2)`);
    } else if (!Array.isArray(fm.summary_points)) {
      diagnostics.errors.push(`${slug}: summary_points debe ser un array`);
    } else {
      const count = fm.summary_points.length;
      if (count < MIN_SUMMARY_POINTS || count > MAX_SUMMARY_POINTS) {
        diagnostics.errors.push(
          `${slug}: summary_points tiene ${count} ítems (mín ${MIN_SUMMARY_POINTS}, máx ${MAX_SUMMARY_POINTS})`
        );
      }
      const emptyItems = fm.summary_points.filter(
        (s) => typeof s !== 'string' || s.trim().length === 0
      );
      if (emptyItems.length > 0) {
        diagnostics.errors.push(
          `${slug}: summary_points contiene ${emptyItems.length} ítem(s) vacío(s)`
        );
      }
    }

    // glossary
    if (!fm.glossary) {
      diagnostics.errors.push(`${slug}: falta glossary (requerido para schema_version >= 2)`);
    } else if (!Array.isArray(fm.glossary)) {
      diagnostics.errors.push(`${slug}: glossary debe ser un array`);
    } else if (fm.glossary.length < MIN_GLOSSARY_ITEMS) {
      diagnostics.errors.push(
        `${slug}: glossary tiene ${fm.glossary.length} ítems (mín ${MIN_GLOSSARY_ITEMS})`
      );
    } else {
      const invalidItems = fm.glossary.filter(
        (g) =>
          typeof g !== 'object' ||
          !g.term ||
          typeof g.term !== 'string' ||
          !g.definition ||
          typeof g.definition !== 'string'
      );
      if (invalidItems.length > 0) {
        diagnostics.errors.push(
          `${slug}: glossary contiene ${invalidItems.length} ítem(s) sin term/definition válidos`
        );
      }
    }

    // fact_check
    if (!fm.fact_check) {
      diagnostics.errors.push(`${slug}: falta fact_check (requerido para schema_version >= 2)`);
    } else if (!Array.isArray(fm.fact_check)) {
      diagnostics.errors.push(`${slug}: fact_check debe ser un array`);
    } else if (fm.fact_check.length < MIN_FACT_CHECK_ITEMS) {
      diagnostics.errors.push(
        `${slug}: fact_check tiene ${fm.fact_check.length} ítems (mín ${MIN_FACT_CHECK_ITEMS})`
      );
    } else {
      const invalidItems = fm.fact_check.filter(
        (f) =>
          typeof f !== 'object' ||
          !f.label ||
          typeof f.label !== 'string' ||
          !f.status ||
          typeof f.status !== 'string'
      );
      if (invalidItems.length > 0) {
        diagnostics.errors.push(
          `${slug}: fact_check contiene ${invalidItems.length} ítem(s) sin label/status válidos`
        );
      }
    }

    // why_it_matters
    if (!fm.why_it_matters) {
      diagnostics.errors.push(`${slug}: falta why_it_matters (requerido para schema_version >= 2)`);
    } else if (!Array.isArray(fm.why_it_matters)) {
      diagnostics.errors.push(`${slug}: why_it_matters debe ser un array`);
    } else if (fm.why_it_matters.length < MIN_WHY_IT_MATTERS_ITEMS) {
      diagnostics.errors.push(
        `${slug}: why_it_matters tiene ${fm.why_it_matters.length} ítems (mín ${MIN_WHY_IT_MATTERS_ITEMS})`
      );
    } else {
      const emptyItems = fm.why_it_matters.filter(
        (s) => typeof s !== 'string' || s.trim().length === 0
      );
      if (emptyItems.length > 0) {
        diagnostics.errors.push(
          `${slug}: why_it_matters contiene ${emptyItems.length} ítem(s) vacío(s)`
        );
      }
    }

    // confidence
    if (!fm.confidence) {
      diagnostics.errors.push(`${slug}: falta confidence (requerido para schema_version >= 2)`);
    } else if (typeof fm.confidence !== 'string') {
      diagnostics.errors.push(`${slug}: confidence debe ser un string`);
    }

    // sources
    if (!fm.sources) {
      diagnostics.errors.push(`${slug}: falta sources (requerido para schema_version >= 2)`);
    } else if (!Array.isArray(fm.sources)) {
      diagnostics.errors.push(`${slug}: sources debe ser un array`);
    } else if (fm.sources.length < MIN_SOURCES) {
      diagnostics.errors.push(
        `${slug}: sources tiene ${fm.sources.length} ítems (mín ${MIN_SOURCES})`
      );
    } else {
      const invalidItems = fm.sources.filter(
        (s) =>
          typeof s !== 'object' ||
          !s.title ||
          typeof s.title !== 'string' ||
          !s.url ||
          typeof s.url !== 'string'
      );
      if (invalidItems.length > 0) {
        diagnostics.errors.push(
          `${slug}: sources contiene ${invalidItems.length} ítem(s) sin title/url válidos`
        );
      }
    }
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Main (CLI entry point)
// ---------------------------------------------------------------------------

const diagnostics = collectEditorialDiagnostics();
const strictMode = process.env.STRICT_EDITORIAL === 'true';

if (diagnostics.v2Count === 0) {
  console.log(`[editorial-fields] No hay artículos con schema_version >= 2. Nada que validar.`);
  process.exit(0);
}

if (diagnostics.errors.length > 0) {
  const label = strictMode ? 'error(es)' : 'aviso(s)';
  console.error(
    `[editorial-fields] ${diagnostics.errors.length} ${label} en ${diagnostics.v2Count} artículo(s) v2:`
  );
  for (const error of diagnostics.errors) {
    const prefix = strictMode ? '❌' : '⚠️';
    console.error(`  ${prefix} ${error}`);
  }

  if (strictMode) {
    console.error(
      `\n[editorial-fields] STRICT_EDITORIAL=true — bloquear build. Corrige los campos o desactiva el flag.`
    );
    process.exit(1);
  } else {
    console.error(
      `\n[editorial-fields] Reporte informativo. Para bloquear, usa STRICT_EDITORIAL=true.`
    );
    process.exit(0);
  }
}

console.log(`[editorial-fields] OK — ${diagnostics.v2Count} artículo(s) v2 validados sin errores.`);
