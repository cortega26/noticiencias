import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { getChangedPostRefineryIds } from '../scripts/utils/publication-ids.js';

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });
}

function commitAll(repoRoot: string, message: string): string {
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', message, '--no-gpg-sign']);
  return git(repoRoot, ['rev-parse', 'HEAD']).trim();
}

describe('getChangedPostRefineryIds', () => {
  let repoRoot: string;
  let postsDir: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'pub-ids-test-'));
    git(repoRoot, ['init', '-q']);
    git(repoRoot, ['config', 'user.email', 'test@example.com']);
    git(repoRoot, ['config', 'user.name', 'Test']);
    postsDir = join(repoRoot, 'src', 'content', 'posts');
    mkdirSync(postsDir, { recursive: true });
    // A tracked placeholder so the initial "base" commit has something to
    // commit (git doesn't track empty directories).
    writeFileSync(join(repoRoot, '.gitkeep'), '');
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('extracts refinery_id from posts added in the commit range', () => {
    const baseSha = commitAll(repoRoot, 'base');

    writeFileSync(
      join(postsDir, 'post-a.md'),
      '---\ntitle: A\nrefinery_id: "101"\n---\nContent A\n'
    );
    writeFileSync(
      join(postsDir, 'post-b.md'),
      '---\ntitle: B\nrefinery_id: "102"\n---\nContent B\n'
    );
    const headSha = commitAll(repoRoot, 'add two posts');

    const ids = getChangedPostRefineryIds({ baseSha, headSha, repoRoot });
    expect(ids.sort()).toEqual(['101', '102']);
  });

  it('ignores posts outside the commit range', () => {
    const baseSha = commitAll(repoRoot, 'base');
    writeFileSync(
      join(postsDir, 'post-a.md'),
      '---\ntitle: A\nrefinery_id: "101"\n---\nContent A\n'
    );
    const headSha = commitAll(repoRoot, 'add post a');

    // A second, later commit that's outside the range we'll query.
    writeFileSync(
      join(postsDir, 'post-c.md'),
      '---\ntitle: C\nrefinery_id: "103"\n---\nContent C\n'
    );
    commitAll(repoRoot, 'add post c (outside range)');

    const ids = getChangedPostRefineryIds({ baseSha, headSha, repoRoot });
    expect(ids).toEqual(['101']);
  });

  it('skips posts with no refinery_id frontmatter field', () => {
    const baseSha = commitAll(repoRoot, 'base');
    writeFileSync(join(postsDir, 'no-id.md'), '---\ntitle: No ID\n---\nContent\n');
    const headSha = commitAll(repoRoot, 'add post with no id');

    const ids = getChangedPostRefineryIds({ baseSha, headSha, repoRoot });
    expect(ids).toEqual([]);
  });

  it('dedupes repeated refinery_id values', () => {
    const baseSha = commitAll(repoRoot, 'base');
    writeFileSync(
      join(postsDir, 'post-a.md'),
      '---\ntitle: A\nrefinery_id: "101"\n---\nContent A\n'
    );
    writeFileSync(
      join(postsDir, 'post-a-copy.md'),
      '---\ntitle: A copy\nrefinery_id: "101"\n---\nContent A copy\n'
    );
    const headSha = commitAll(repoRoot, 'add duplicate id');

    const ids = getChangedPostRefineryIds({ baseSha, headSha, repoRoot });
    expect(ids).toEqual(['101']);
  });

  it('ignores non-post file changes', () => {
    const baseSha = commitAll(repoRoot, 'base');
    writeFileSync(join(repoRoot, 'README.md'), 'unrelated change');
    const headSha = commitAll(repoRoot, 'unrelated change');

    const ids = getChangedPostRefineryIds({ baseSha, headSha, repoRoot });
    expect(ids).toEqual([]);
  });

  it('returns empty and warns when baseSha or headSha is missing', () => {
    const ids = getChangedPostRefineryIds({ baseSha: '', headSha: 'abc', repoRoot });
    expect(ids).toEqual([]);
  });

  it('returns empty on an invalid commit range rather than throwing', () => {
    const ids = getChangedPostRefineryIds({
      baseSha: 'not-a-real-sha',
      headSha: 'also-not-real',
      repoRoot,
    });
    expect(ids).toEqual([]);
  });
});
