import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectImageAltDiagnostics,
  isBoilerplateHeroAlt,
  isGenericHeroAlt,
} from '../scripts/utils/hero-alt.js';

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-hero-alt-'));
  tempDirs.push(repoRoot);

  fs.mkdirSync(path.join(repoRoot, 'src', 'content', 'posts'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'data'), { recursive: true });

  return repoRoot;
}

function writePost(
  repoRoot: string,
  filename: string,
  {
    image = '~/assets/images/real.png',
    imageAlt = 'alt text',
  }: { image?: string; imageAlt?: string } = {}
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

function writeAllowlist(repoRoot: string, entries: Record<string, string>): void {
  fs.writeFileSync(
    path.join(repoRoot, 'data', 'hero-image-alt-allowlist.json'),
    `${JSON.stringify({ allowedAlts: entries }, null, 2)}\n`,
    'utf8'
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('hero-alt boilerplate detection', () => {
  it('detects the pipeline boilerplate regardless of case or surrounding spaces', () => {
    expect(isBoilerplateHeroAlt('Ilustración editorial relacionada con Algo')).toBe(true);
    expect(isBoilerplateHeroAlt('  ilustración editorial relacionada con algo  ')).toBe(true);
    expect(isBoilerplateHeroAlt('Fotografía de un rollo réplica de papiro.')).toBe(false);
    expect(isBoilerplateHeroAlt('')).toBe(false);
    expect(isBoilerplateHeroAlt(undefined)).toBe(false);
  });

  it('keeps banning the "Imagen de" prefix', () => {
    expect(isGenericHeroAlt('Imagen de un laboratorio')).toBe(true);
    expect(isGenericHeroAlt('Fotografía de un laboratorio')).toBe(false);
  });

  it('passes a descriptive alt with no allowlist', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-good.md', {
      imageAlt: 'Fotografía comparativa de dos rollos réplica de papiro.',
    });

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toEqual([]);
  });

  it('fails a boilerplate alt that is not allowlisted', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-boilerplate.md', {
      imageAlt: 'Ilustración editorial relacionada con Algo',
    });

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('pipeline boilerplate');
  });

  it('passes an allowlisted boilerplate alt with an explicit reason', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-legacy.md', {
      imageAlt: 'Ilustración editorial relacionada con Algo',
    });
    writeAllowlist(repoRoot, {
      'src/content/posts/2026-04-02-legacy.md': 'Legacy post, needs a rewrite.',
    });

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toEqual([]);
  });

  it('fails an allowlisted entry with an empty reason', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-legacy.md', {
      imageAlt: 'Ilustración editorial relacionada con Algo',
    });
    writeAllowlist(repoRoot, { 'src/content/posts/2026-04-02-legacy.md': '   ' });

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('pipeline boilerplate');
  });

  it('fails stale allowlist entries for posts that no longer use a boilerplate alt', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-fixed.md', {
      imageAlt: 'Fotografía real del experimento.',
    });
    writeAllowlist(repoRoot, {
      'src/content/posts/2026-04-02-fixed.md': 'Old reason.',
    });

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('stale');
    expect(result.staleAllowlistEntries).toEqual(['src/content/posts/2026-04-02-fixed.md']);
  });

  it('skips posts without an image', () => {
    const repoRoot = makeRepo();
    fs.writeFileSync(
      path.join(repoRoot, 'src', 'content', 'posts', '2026-04-02-no-image.md'),
      `---
title: Test
---

Body
`,
      'utf8'
    );

    const result = collectImageAltDiagnostics({ repoRoot });

    expect(result.errors).toEqual([]);
  });
});
