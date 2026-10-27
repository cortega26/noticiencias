#!/usr/bin/env node
/**
 * article-dataset.mjs — per-article dataset for the Discover (#234) and
 * publishing-cadence (#233) experiments.
 *
 * Always builds the editorial features from the published posts. When
 * Search Console credentials are available, it adds per-article Discover and
 * Web performance at 1, 7 and 28 days after publication.
 *
 * No personal data: only page-level aggregates.
 *
 * Usage:
 *   node scripts/analytics/article-dataset.mjs [--out data/analytics]
 *
 * Search Console (optional):
 *   GSC_CREDENTIALS  path to a service-account JSON with read access to the
 *                    property (add its client_email as a user in Search Console)
 *   GSC_SITE         property, default "sc-domain:noticiencias.com"
 */

import { createSign } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from '../utils/frontmatter-parser.js';

const REPO_ROOT = process.env.DATASET_ROOT
  ? resolve(process.env.DATASET_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POSTS_DIR = resolve(REPO_ROOT, 'src', 'content', 'posts');
const DAY_MS = 86_400_000;
const WINDOWS = [1, 7, 28];

// ---------------------------------------------------------------------------
// Editorial features (pure)
// ---------------------------------------------------------------------------

export function headlineFeatures(title) {
  const text = String(title ?? '').trim();
  return {
    title_chars: text.length,
    title_words: text ? text.split(/\s+/).length : 0,
    title_is_question: /[¿?]/.test(text),
    title_has_number: /\d/.test(text),
    title_has_colon: /:/.test(text),
    title_has_quote: /["«»“”]/.test(text),
  };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function wordCount(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Posts published in the `hours` before `ts` (excluding the post itself). */
function priorCount(timestamps, ts, hours) {
  const from = ts - hours * 3_600_000;
  return timestamps.filter((t) => t < ts && t >= from).length;
}

export function buildEditorialRows(posts) {
  const sorted = [...posts].sort((a, b) => a.published - b.published);
  const times = sorted.map((p) => p.published.getTime());
  return sorted.map((post) => {
    const ts = post.published.getTime();
    const d = post.data;
    const categories = [].concat(d.categories ?? d.category ?? []);
    const tags = [].concat(d.tags ?? []);
    return {
      slug: post.slug,
      published_at: post.published.toISOString(),
      weekday_utc: post.published.getUTCDay(),
      hour_utc: post.published.getUTCHours(),
      category: categories[0] ?? '',
      tags: tags.join('|'),
      tag_count: tags.length,
      title: d.title ?? '',
      ...headlineFeatures(d.title),
      word_count: wordCount(post.content),
      source_host: hostOf(d.source_url),
      sources_count: Array.isArray(d.sources) ? d.sources.length : 0,
      has_image: Boolean(d.image),
      confidence: d.confidence ?? '',
      requires_uncertainty_note: Boolean(d.requires_uncertainty_note),
      glossary_terms: Array.isArray(d.glossary) ? d.glossary.length : 0,
      posts_prev_24h: priorCount(times, ts, 24),
      posts_prev_7d: priorCount(times, ts, 24 * 7),
    };
  });
}

function loadPosts() {
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(readFileSync(resolve(POSTS_DIR, file), 'utf8'));
      return { slug: basename(file, '.md'), data, content, published: new Date(data.date) };
    })
    .filter((p) => !Number.isNaN(p.published.getTime()) && !p.data.draft);
}

// ---------------------------------------------------------------------------
// Search Console (optional)
// ---------------------------------------------------------------------------

async function gscToken(credentialsPath) {
  const sa = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Search Console auth failed: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

/** Rows of {slug, date, clicks, impressions} for one search type. */
async function gscDaily(token, site, type, startDate, endDate) {
  const rows = [];
  for (let startRow = 0; ; startRow += 25_000) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          type,
          dimensions: ['page', 'date'],
          rowLimit: 25_000,
          startRow,
          dataState: 'final',
        }),
      }
    );
    if (!res.ok) throw new Error(`Search Console ${type} query failed: HTTP ${res.status}`);
    const batch = (await res.json()).rows ?? [];
    for (const r of batch) {
      const slug = new URL(r.keys[0]).pathname.split('/').filter(Boolean).pop() ?? '';
      rows.push({ slug, date: r.keys[1], clicks: r.clicks, impressions: r.impressions });
    }
    if (batch.length < 25_000) return rows;
  }
}

/** Adds {type}_{metric}_{N}d columns: totals in the N days after publication. */
export function addWindows(rows, daily, type) {
  const bySlug = new Map();
  for (const r of daily) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
    bySlug.get(r.slug).push(r);
  }
  for (const row of rows) {
    const start = Date.parse(row.published_at.slice(0, 10));
    const entries = bySlug.get(row.slug) ?? [];
    for (const n of WINDOWS) {
      const inWindow = entries.filter((e) => {
        const t = Date.parse(e.date);
        return t >= start && t < start + n * DAY_MS;
      });
      const clicks = inWindow.reduce((s, e) => s + e.clicks, 0);
      const impressions = inWindow.reduce((s, e) => s + e.impressions, 0);
      row[`${type}_impressions_${n}d`] = impressions;
      row[`${type}_clicks_${n}d`] = clicks;
      row[`${type}_ctr_${n}d`] = impressions ? +(clicks / impressions).toFixed(4) : '';
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export function toCsv(rows) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join(
    '\n'
  );
}

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const outDir = resolve(REPO_ROOT, outIdx > -1 ? process.argv[outIdx + 1] : 'data/analytics');
  const rows = buildEditorialRows(loadPosts());
  const notes = [];

  if (process.env.GSC_CREDENTIALS) {
    const site = process.env.GSC_SITE ?? 'sc-domain:noticiencias.com';
    const token = await gscToken(process.env.GSC_CREDENTIALS);
    const start = rows[0]?.published_at.slice(0, 10);
    // Search Console keeps 16 months; the API rejects older start dates.
    const floor = new Date(Date.now() - 480 * DAY_MS).toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    for (const type of ['discover', 'web']) {
      addWindows(rows, await gscDaily(token, site, type, start > floor ? start : floor, end), type);
    }
    notes.push(`Search Console: ${site}`);
  } else {
    notes.push('Search Console: not configured (set GSC_CREDENTIALS); editorial features only');
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'article-dataset.csv'), toCsv(rows) + '\n');
  console.log(`${rows.length} articles -> ${resolve(outDir, 'article-dataset.csv')}`);
  for (const n of notes) console.log(n);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
