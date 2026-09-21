import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHECK_SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check-image-alt.js');

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-image-alt-'));
  tempDirs.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, 'src', 'content', 'posts'), { recursive: true });
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

function runCheck(repoRoot: string): {
  status: string;
  errors: { file: string; message: string }[];
  exitCode: number;
} {
  try {
    const stdout = execFileSync(
      process.execPath,
      [CHECK_SCRIPT, '--json', `--repoRoot=${repoRoot}`],
      { encoding: 'utf8' }
    );
    return { ...JSON.parse(stdout), exitCode: 0 };
  } catch (err: unknown) {
    const { stdout } = err as { stdout: string };
    return { ...JSON.parse(stdout), exitCode: 1 };
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('check-image-alt', () => {
  it('passes a descriptive alt', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-good.md', {
      imageAlt: 'Fotografía comparativa de dos rollos réplica de papiro.',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('pass');
    expect(result.errors).toEqual([]);
  });

  it('fails a missing alt', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-missing.md', { imageAlt: '' });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("missing 'image_alt'");
  });

  it('fails the "Imagen de" prefix', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-generic.md', { imageAlt: 'Imagen de un laboratorio' });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Imagen de');
  });

  it('fails the pipeline boilerplate', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-boilerplate.md', {
      imageAlt: 'Ilustración editorial relacionada con Algo',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('pipeline boilerplate');
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

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
