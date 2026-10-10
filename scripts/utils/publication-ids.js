/**
 * Derives the bounded set of changed `refinery_id` values and the exact post
 * bytes in a Git range. Attempt references add the originating PR number so
 * callbacks cannot be applied to a different attempt for the same article.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from './frontmatter-parser.js';

const POSTS_PATH_PREFIX = 'src/content/posts/';
const MAX_PUBLICATION_IDS = 200;
const GITHUB_API_VERSION = '2022-11-28';

function getChangedPosts({ baseSha, headSha, repoRoot }) {
  if (!baseSha || !headSha) {
    console.warn(
      '[publication-ids] Missing base/head SHA — cannot bound the changed-post ' +
        'set, returning empty publication_ids rather than guessing.'
    );
    return [];
  }

  const diff = spawnSync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=ACM',
      '-z',
      `${baseSha}..${headSha}`,
      '--',
      POSTS_PATH_PREFIX,
    ],
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
    .split('\0')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.md') || line.endsWith('.mdx'));

  const posts = [];
  for (const relativePath of changedFiles) {
    let rawContent;
    try {
      rawContent = readFileSync(resolve(repoRoot, relativePath));
    } catch {
      continue; // file was removed after headSha or cannot be read
    }

    let refineryId;
    try {
      const value = matter(rawContent.toString('utf-8')).data?.refinery_id;
      if (typeof value === 'string' && value.trim()) refineryId = value.trim();
      else if (typeof value === 'number') refineryId = String(value);
    } catch {
      continue; // malformed frontmatter is reported by the content checks
    }

    if (!refineryId) continue;
    posts.push({
      refineryId,
      relativePath,
      contentSha256: createHash('sha256').update(rawContent).digest('hex'),
    });
  }
  return posts;
}

/**
 * @param {object} opts
 * @param {string} opts.baseSha
 * @param {string} opts.headSha
 * @param {string} opts.repoRoot
 * @returns {string[]} deduped, bounded refinery_id values.
 */
export function getChangedPostRefineryIds({ baseSha, headSha, repoRoot }) {
  const ids = [
    ...new Set(getChangedPosts({ baseSha, headSha, repoRoot }).map((p) => p.refineryId)),
  ];
  if (ids.length > MAX_PUBLICATION_IDS) {
    console.warn(
      `[publication-ids] ${ids.length} changed posts exceeds the ` +
        `${MAX_PUBLICATION_IDS}-id contract limit — truncating.`
    );
    return ids.slice(0, MAX_PUBLICATION_IDS);
  }
  return ids;
}

function gitCommitForPost({ baseSha, headSha, repoRoot, relativePath }) {
  const result = spawnSync(
    'git',
    ['log', '-1', '--format=%H', `${baseSha}..${headSha}`, '--', relativePath],
    { cwd: repoRoot, encoding: 'utf-8' }
  );
  if (result.status !== 0) return null;
  const sha = result.stdout.trim();
  return /^[0-9a-f]{40,64}$/i.test(sha) ? sha : null;
}

async function pullRequestForCommit({ repository, commitSha, branch, token, apiUrl, fetchImpl }) {
  const [owner, repo, ...extra] = String(repository || '').split('/');
  if (!owner || !repo || extra.length || !token) return null;

  let response;
  try {
    const endpoint =
      `${String(apiUrl || 'https://api.github.com').replace(/\/+$/, '')}` +
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
      `/commits/${encodeURIComponent(commitSha)}/pulls?per_page=100`;
    response = await fetchImpl(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    });
  } catch {
    console.warn(
      `[publication-ids] PR association lookup failed for commit ${commitSha.slice(0, 12)}.`
    );
    return null;
  }

  if (!response.ok) {
    console.warn(
      `[publication-ids] PR association lookup returned HTTP ${response.status} ` +
        `for commit ${commitSha.slice(0, 12)}.`
    );
    return null;
  }

  let associated;
  try {
    associated = await response.json();
  } catch {
    return null;
  }
  if (!Array.isArray(associated)) return null;
  if (associated.length >= 100) {
    console.warn(
      `[publication-ids] PR association lookup for commit ${commitSha.slice(0, 12)} ` +
        'reached the page limit; omitting an ambiguous attempt reference.'
    );
    return null;
  }

  const merged = associated.filter(
    (item) =>
      item &&
      Number.isSafeInteger(item.number) &&
      item.number > 0 &&
      item.merged_at &&
      (!branch || item.base?.ref === branch)
  );
  const numbers = [...new Set(merged.map((item) => item.number))];
  return numbers.length === 1 ? numbers[0] : null;
}

/**
 * Build references that identify the exact stored publication attempt.
 * Pull request checks supply the PR number directly. Push callbacks resolve
 * each post's last changed commit through GitHub's associated-PR endpoint;
 * missing or ambiguous evidence is omitted so the backend fails closed.
 *
 * @param {object} opts
 * @param {string} opts.baseSha
 * @param {string} opts.headSha
 * @param {string} opts.repoRoot
 * @param {number|string} [opts.pullRequestNumber]
 * @param {string} [opts.repository]
 * @param {string} [opts.branch]
 * @param {string} [opts.token]
 * @param {string} [opts.apiUrl]
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<Array<{refinery_id: string, pull_request_number: number, content_sha256: string}>>}
 */
export async function getChangedPostAttemptRefs({
  baseSha,
  headSha,
  repoRoot,
  pullRequestNumber,
  repository,
  branch,
  token,
  apiUrl,
  fetchImpl = fetch,
}) {
  const posts = getChangedPosts({ baseSha, headSha, repoRoot });
  const byId = new Map();
  for (const post of posts) {
    const matches = byId.get(post.refineryId) || [];
    matches.push(post);
    byId.set(post.refineryId, matches);
  }
  const allowedIds = new Set([...byId.keys()].slice(0, MAX_PUBLICATION_IDS));

  const directPullRequestNumber = Number(pullRequestNumber);
  const hasDirectPullRequest =
    Number.isSafeInteger(directPullRequestNumber) && directPullRequestNumber > 0;
  const refs = [];
  for (const [refineryId, matches] of byId) {
    if (!allowedIds.has(refineryId)) continue;
    if (matches.length !== 1) {
      console.warn(
        `[publication-ids] refinery_id ${refineryId} maps to multiple changed posts; ` +
          'omitting its attempt reference.'
      );
      continue;
    }

    const [post] = matches;
    let prNumber = hasDirectPullRequest ? directPullRequestNumber : null;
    if (!prNumber) {
      const commitSha = gitCommitForPost({
        baseSha,
        headSha,
        repoRoot,
        relativePath: post.relativePath,
      });
      if (!commitSha) {
        console.warn(
          `[publication-ids] Could not identify the changed commit for ${post.relativePath}; ` +
            'omitting its attempt reference.'
        );
        continue;
      }
      prNumber = await pullRequestForCommit({
        repository,
        commitSha,
        branch,
        token,
        apiUrl,
        fetchImpl,
      });
      if (!prNumber) {
        console.warn(
          `[publication-ids] No unique merged PR found for ${post.relativePath}; ` +
            'omitting its attempt reference.'
        );
        continue;
      }
    }

    refs.push({
      refinery_id: refineryId,
      pull_request_number: prNumber,
      content_sha256: post.contentSha256,
    });
  }
  return refs;
}
