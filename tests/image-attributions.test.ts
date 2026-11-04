import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-image-attributions.js');
const dirs: string[] = [];
const image = '~/assets/images/example.jpg';
const bytes = Buffer.from('sample image bytes');
const digest = createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-attribution-'));
  dirs.push(dir);
  for (const sub of ['src/content/posts', 'src/assets/images', 'data']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'src/content/posts/post.md'),
    `---\nimage: ${image}\nimage_alt: 'Foto de autor, CC BY 2.0'\n---\n`
  );
  fs.writeFileSync(path.join(dir, 'src/assets/images/example.jpg'), bytes);
  writeManifest(dir, {
    [image]: {
      source: 'https://example.org/photo',
      license: 'https://creativecommons.org/licenses/by/2.0/',
      sha256: digest,
    },
  });
  return dir;
}

function writeManifest(dir: string, entries: unknown) {
  fs.writeFileSync(path.join(dir, 'data/image-attributions.json'), JSON.stringify(entries));
}

function check(dir: string) {
  const run = spawnSync(process.execPath, [script, '--json', `--repoRoot=${dir}`], {
    encoding: 'utf8',
  });
  return { code: run.status, ...JSON.parse(run.stdout) };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('image attribution guard', () => {
  it('accepts an identified image with matching links and digest', () => {
    expect(check(fixture())).toMatchObject({ code: 0, status: 'pass', errors: [] });
  });

  it('rejects replacing bytes at the same path', () => {
    const dir = fixture();
    fs.writeFileSync(path.join(dir, 'src/assets/images/example.jpg'), 'different bytes');
    expect(check(dir)).toMatchObject({
      code: 1,
      errors: [{ message: expect.stringContaining('SHA-256 mismatch') }],
    });
  });

  it('rejects a missing or wrong license for an explicit CC BY label', () => {
    const dir = fixture();
    writeManifest(dir, {});
    expect(check(dir)).toMatchObject({
      code: 1,
      errors: [{ message: expect.stringContaining('matching attribution') }],
    });
    writeManifest(dir, {
      [image]: {
        source: 'https://example.org/photo',
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sha256: digest,
      },
    });
    expect(check(dir).code).toBe(1);
  });

  it('rejects removal of the license label from a registered CC image', () => {
    const dir = fixture();
    fs.writeFileSync(
      path.join(dir, 'src/content/posts/post.md'),
      `---\nimage: ${image}\nimage_alt: 'Foto de autor'\n---\n`
    );
    expect(check(dir)).toMatchObject({
      code: 1,
      errors: [{ message: expect.stringContaining('requires its license in image_alt') }],
    });
  });

  it('checks CC0 labels against the registered dedication', () => {
    const dir = fixture();
    const post = path.join(dir, 'src/content/posts/post.md');
    const entry = {
      source: 'https://example.org/photo',
      license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sha256: digest,
    };
    writeManifest(dir, { [image]: entry });
    for (const label of ['CC0', 'CC0 1.0']) {
      fs.writeFileSync(post, `---\nimage: ${image}\nimage_alt: 'Foto, ${label}'\n---\n`);
      expect(check(dir)).toMatchObject({ code: 0, status: 'pass' });
    }
    for (const label of ['Foto sin etiqueta', 'CC0 2.0']) {
      fs.writeFileSync(post, `---\nimage: ${image}\nimage_alt: '${label}'\n---\n`);
      expect(check(dir).code).toBe(1);
    }
    fs.writeFileSync(post, `---\nimage: ${image}\nimage_alt: 'Foto, CC0'\n---\n`);
    writeManifest(dir, {});
    expect(check(dir).code).toBe(1);
  });

  it('rejects invalid links, stale entries, and a missing manifest', () => {
    const dir = fixture();
    writeManifest(dir, {
      [image]: {
        source: 'javascript:alert(1)',
        license: 'https://creativecommons.org/licenses/by/2.0/',
        sha256: digest,
      },
    });
    expect(
      check(dir).errors.some((e: { message: string }) => e.message.includes('invalid HTTPS'))
    ).toBe(true);
    fs.writeFileSync(
      path.join(dir, 'src/content/posts/post.md'),
      '---\nimage: ~/assets/images/other.jpg\nimage_alt: otra imagen\n---\n'
    );
    expect(
      check(dir).errors.some((e: { message: string }) => e.message.includes('unreferenced'))
    ).toBe(true);
    fs.rmSync(path.join(dir, 'data/image-attributions.json'));
    expect(
      check(dir).errors.some((e: { message: string }) => e.message.includes('cannot read'))
    ).toBe(true);
  });
});
