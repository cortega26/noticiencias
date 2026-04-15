import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { collectPublishedContentSidecarDiagnostics } from '../scripts/utils/published-content-sidecars.js';

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-published-sidecars-'));
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

function writePost(repoRoot: string, filename: string): void {
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
image: "~/assets/images/default.png"
image_alt: "alt text"
---

Body
`,
    'utf8'
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('published content sidecars', () => {
  it('reports stale manifest and allowlist entries', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-live.md');
    fs.writeFileSync(
      path.join(repoRoot, 'src', 'content', 'posts', 'refinery_manifest.json'),
      JSON.stringify(
        {
          live: '2026-04-02-live.md',
          deleted: '2026-04-02-deleted.md',
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'data', 'hero-image-placeholder-allowlist.json'),
      JSON.stringify(
        {
          allowedPlaceholders: {
            'src/content/posts/2026-04-02-live.md': 'Keep.',
            'src/content/posts/2026-04-02-deleted.md': 'Stale.',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const diagnostics = collectPublishedContentSidecarDiagnostics({ repoRoot });

    expect(diagnostics.staleManifestEntries).toEqual([
      { articleId: 'deleted', fileName: '2026-04-02-deleted.md' },
    ]);
    expect(diagnostics.staleAllowlistEntries).toEqual(['src/content/posts/2026-04-02-deleted.md']);
  });

  it('passes when sidecars only reference existing posts', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-live.md');
    fs.writeFileSync(
      path.join(repoRoot, 'src', 'content', 'posts', 'refinery_manifest.json'),
      JSON.stringify({ live: '2026-04-02-live.md' }, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'data', 'hero-image-placeholder-allowlist.json'),
      JSON.stringify(
        {
          allowedPlaceholders: {
            'src/content/posts/2026-04-02-live.md': 'Keep.',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const diagnostics = collectPublishedContentSidecarDiagnostics({ repoRoot });

    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.staleManifestEntries).toEqual([]);
    expect(diagnostics.staleAllowlistEntries).toEqual([]);
  });
});
