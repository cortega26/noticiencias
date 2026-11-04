import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('scripts/broken-link-checker.js');
const fixtures: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'noticiencias-links-'));
  fixtures.push(root);
  return root;
}

function run(root: string) {
  return spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('broken link monitor', () => {
  it('checks root-relative, relative and same-site absolute links while ignoring external links', () => {
    const root = fixture();
    mkdirSync(join(root, 'article'), { recursive: true });
    writeFileSync(
      join(root, 'index.html'),
      '<a href="/article/?q=1#part">article</a><a href="/missing-root/">missing root path</a>'
    );
    writeFileSync(
      join(root, 'article', 'index.html'),
      '<a href="../">home</a><a href="https://noticiencias.com/absent/">missing</a><a href="https://other.example/absent/">external</a>'
    );

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Checked 4 internal links');
    expect(result.stderr).toContain('/missing-root/');
    expect(result.stderr).toContain('https://noticiencias.com/absent/');
    expect(result.stderr).not.toContain('other.example');
  });

  it('passes for valid internal links and fails closed for empty inputs', () => {
    const root = fixture();
    writeFileSync(join(root, 'index.html'), '<a href="/">home</a>');
    expect(run(root).status).toBe(0);
    writeFileSync(join(root, 'index.html'), '<a href="https://other.example/">external</a>');
    expect(run(root).status).toBe(1);
    expect(run(join(root, 'missing')).status).toBe(1);
  });
});
