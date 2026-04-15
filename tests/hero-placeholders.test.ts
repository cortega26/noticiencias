import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_IMAGE_PATH,
  collectHeroImageDiagnostics,
  syncHeroPlaceholderAllowlist,
} from '../scripts/utils/hero-placeholders.js';

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-hero-placeholders-'));
  tempDirs.push(repoRoot);

  fs.mkdirSync(path.join(repoRoot, 'src', 'content', 'posts'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'src', 'assets', 'images'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'src', 'assets', 'images', 'default.png'),
    'placeholder',
    'utf8'
  );

  return repoRoot;
}

function writePost(
  repoRoot: string,
  filename: string,
  { image = DEFAULT_IMAGE_PATH, imageAlt = 'alt text' }: { image?: string; imageAlt?: string } = {}
): void {
  fs.writeFileSync(
    path.join(repoRoot, 'src', 'content', 'posts', filename),
    `---
title: Test
schema_version: 2
excerpt: A sufficiently long excerpt for testing.
author: Noticiencias
date: 2026-04-02
categories:
  - Ciencia
tags:
  - prueba
image: "${image}"
image_alt: "${imageAlt}"
---

Body
`,
    'utf8'
  );
}

function writeAllowlist(repoRoot: string, entries: Record<string, string>): string {
  const allowlistPath = path.join(repoRoot, 'data', 'hero-image-placeholder-allowlist.json');
  fs.writeFileSync(
    allowlistPath,
    `${JSON.stringify({ allowedPlaceholders: entries }, null, 2)}\n`,
    'utf8'
  );
  return allowlistPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('hero placeholder sync', () => {
  it('removes stale allowlist entries for deleted posts', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-active.md');
    const allowlistPath = writeAllowlist(repoRoot, {
      'src/content/posts/2026-04-02-active.md': 'Keep this placeholder.',
      'src/content/posts/2026-04-02-deleted.md': 'This post was deleted.',
    });

    const result = syncHeroPlaceholderAllowlist({ repoRoot });
    const synced = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

    expect(result.changed).toBe(true);
    expect(result.staleAllowlistEntries).toEqual(['src/content/posts/2026-04-02-deleted.md']);
    expect(synced.allowedPlaceholders).toEqual({
      'src/content/posts/2026-04-02-active.md': 'Keep this placeholder.',
    });
  });

  it('removes stale allowlist entries when a post no longer uses the placeholder image', () => {
    const repoRoot = makeRepo();
    fs.writeFileSync(
      path.join(repoRoot, 'src', 'assets', 'images', 'real.png'),
      'real image',
      'utf8'
    );
    writePost(repoRoot, '2026-04-02-real-image.md', {
      image: '~/assets/images/real.png',
    });
    const allowlistPath = writeAllowlist(repoRoot, {
      'src/content/posts/2026-04-02-real-image.md': 'Old placeholder reason.',
    });

    const result = syncHeroPlaceholderAllowlist({ repoRoot });
    const synced = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));

    expect(result.changed).toBe(true);
    expect(result.staleAllowlistEntries).toEqual(['src/content/posts/2026-04-02-real-image.md']);
    expect(synced.allowedPlaceholders).toEqual({});
  });

  it('fails when a current placeholder post has no explicit allowlist reason', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-missing-reason.md');
    writeAllowlist(repoRoot, {});

    const result = syncHeroPlaceholderAllowlist({ repoRoot });

    expect(result.errors).toContain(
      'src/content/posts/2026-04-02-missing-reason.md: placeholder image ~/assets/images/default.png is not allowlisted with an explicit reason'
    );
  });

  it('keeps the allowlist byte-stable when no sync changes are needed', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-stable.md');
    const allowlistPath = writeAllowlist(repoRoot, {
      'src/content/posts/2026-04-02-stable.md': 'Stable placeholder reason.',
    });
    const before = fs.readFileSync(allowlistPath, 'utf8');

    const diagnostics = collectHeroImageDiagnostics({ repoRoot });
    const result = syncHeroPlaceholderAllowlist({ repoRoot });
    const after = fs.readFileSync(allowlistPath, 'utf8');

    expect(diagnostics.staleAllowlistEntries).toEqual([]);
    expect(result.changed).toBe(false);
    expect(after).toBe(before);
  });
});
