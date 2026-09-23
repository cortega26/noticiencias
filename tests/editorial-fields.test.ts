import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHECK_SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check-editorial-fields.js');

const tempDirs: string[] = [];

function makeRepo(): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noti-editorial-'));
  tempDirs.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, 'src', 'content', 'posts'), { recursive: true });
  return repoRoot;
}

const BASE_V2 = {
  title: 'Test',
  schema_version: 2,
  excerpt: 'Excerpt',
  author: 'Noticiencias',
  date: '2026-04-02',
  categories: ['Ciencia'],
  tags: ['prueba'],
  image: '~/assets/images/real.png',
  image_alt: 'alt',
  summary_points: ['Uno', 'Dos'],
  glossary: [{ term: 'Término', definition: 'Definición' }],
  fact_check: [{ label: 'Afirmación', status: 'confirmed' }],
  confidence: 'Alta — estudio revisado por pares.',
  sources: [{ title: 'Paper', url: 'https://example.com/paper', role: 'primary' }],
};

function writePost(repoRoot: string, filename: string, frontmatter: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(repoRoot, 'src', 'content', 'posts', filename),
    `---\n${yaml.dump(frontmatter)}---\n\nBody\n`,
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

describe('check-editorial-fields', () => {
  it('passes a complete v2 post with the new evidence fields', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-good.md', {
      ...BASE_V2,
      evidence_subject_type: 'humans',
      evidence_detail: 'Ensayo clínico con 120 participantes durante 12 semanas.',
      institution: 'Universidad de Chile',
      publication_status: 'peer_reviewed',
      reviewer_name: 'Revisora Editorial',
      reviewer_role: 'Editora de Salud',
      reviewer_profile_url: 'https://example.com/perfil',
      review_date: '2026-04-01',
      known_points: ['Uno', 'Dos'],
      open_questions: ['Queda por confirmar el efecto a largo plazo.'],
      corrected_at: '2026-04-03',
      correction_summary: 'Se corrigió el tamaño de muestra.',
      requires_uncertainty_note: true,
      uncertainty_note: 'Resultado preliminar.',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('rejects an unknown evidence_subject_type', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-evidence.md', {
      ...BASE_V2,
      evidence_subject_type: 'simulacion',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('evidence_subject_type inválido');
  });

  it('rejects a doi without role: primary', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-doi.md', {
      ...BASE_V2,
      sources: [
        {
          title: 'Paper',
          url: 'https://doi.org/10.1371/journal.pone.0000000',
          doi: '10.1371/journal.pone.0000000',
          role: 'secondary',
        },
      ],
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('role: primary');
  });

  it('rejects an invalid source role', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-role.md', {
      ...BASE_V2,
      sources: [{ title: 'Paper', url: 'https://example.com/paper', role: 'main' }],
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('role inválido');
  });

  it('rejects corrections that do not travel together', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-correction.md', {
      ...BASE_V2,
      corrected_at: '2026-04-03',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('deben declararse juntos');
  });

  it('rejects more than three known_points', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-points.md', {
      ...BASE_V2,
      known_points: ['Uno', 'Dos', 'Tres', 'Cuatro'],
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('máx 3');
  });

  it('rejects a malformed reviewer_profile_url', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-reviewer.md', {
      ...BASE_V2,
      reviewer_profile_url: 'no-es-una-url',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('reviewer_profile_url');
  });

  it('skips v1 posts', () => {
    const repoRoot = makeRepo();
    writePost(repoRoot, '2026-04-02-v1.md', {
      title: 'Legacy',
      schema_version: 1,
      excerpt: 'Excerpt',
      date: '2026-04-02',
    });

    const result = runCheck(repoRoot);

    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('pass');
  });
});
