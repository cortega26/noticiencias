/**
 * Derives the bounded set of `publication_ids` (refinery_id values) touched
 * by a specific git commit range — used by backend-notify.js callers so a
 * webhook event names exactly the articles it concerns, never every
 * currently-publishing row (plan 021).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';

const POSTS_PATH_PREFIX = 'src/content/posts/';
const MAX_PUBLICATION_IDS = 200;

/**
 * @param {object} opts
 * @param {string} opts.baseSha - commit before the change range.
 * @param {string} opts.headSha - commit after the change range.
 * @param {string} opts.repoRoot - repository root (absolute path).
 * @returns {string[]} deduped, bounded refinery_id values for posts that
 *   were added or modified in the range and still exist at headSha's
 *   checked-out worktree.
 */
export function getChangedPostRefineryIds({ baseSha, headSha, repoRoot }) {
  if (!baseSha || !headSha) {
    console.warn(
      '[publication-ids] Missing base/head SHA — cannot bound the changed-post ' +
        'set, returning empty publication_ids rather than guessing.'
    );
    return [];
  }

  const diff = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACM', `${baseSha}..${headSha}`, '--', POSTS_PATH_PREFIX],
    { cwd: repoRoot, encoding: 'utf-8' }
  );

  if (diff.status !== 0) {
    console.warn(
      `[publication-ids] git diff failed (${baseSha}..${headSha}): ` +
        `${diff.stderr?.trim() || 'unknown error'}. Returning empty publication_ids.`
    );
    return [];
  }

  const changedFiles = diff.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.md') || line.endsWith('.mdx'));

  const ids = new Set();
  for (const relativePath of changedFiles) {
    const absolutePath = resolve(repoRoot, relativePath);
    let content;
    try {
      content = readFileSync(absolutePath, 'utf-8');
    } catch {
      continue; // file deleted since headSha, or otherwise unreadable
    }

    let refineryId;
    try {
      refineryId = matter(content).data?.refinery_id;
    } catch {
      continue; // malformed frontmatter — not this script's job to fix
    }

    if (typeof refineryId === 'string' && refineryId.trim()) {
      ids.add(refineryId.trim());
    } else if (typeof refineryId === 'number') {
      ids.add(String(refineryId));
    }
  }

  const result = [...ids];
  if (result.length > MAX_PUBLICATION_IDS) {
    console.warn(
      `[publication-ids] ${result.length} changed posts exceeds the ` +
        `${MAX_PUBLICATION_IDS}-id contract limit — truncating.`
    );
    return result.slice(0, MAX_PUBLICATION_IDS);
  }
  return result;
}
