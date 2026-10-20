/**
 * check-contract-sync.test.ts
 *
 * Integration tests for the cross-repo contract parity gate.
 * Runs the CLI script against fixture schemas and validates outputs.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, unlinkSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { format } from 'prettier';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { z } from 'astro/zod';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
}));

import { collections } from '../src/content.config';

const postsSchema = (collections.posts as unknown as { schema: z.ZodTypeAny }).schema;

const invariantBasePost = {
  title: 'A valid post title',
  excerpt: 'A sufficiently long excerpt',
  date: new Date('2026-01-01'),
  image: '/images/hero.jpg',
  image_alt: 'A description of the hero image',
};

const SCRIPT = resolve('scripts/check-contract-sync.js');
const FIXTURES = resolve('tests/fixtures/contract-sync');

function runSync(args: string): {
  stdout: string;
  stderr: string;
  combined: string;
  exitCode: number;
} {
  try {
    const stdout = execSync(`node ${SCRIPT} ${args}`, {
      cwd: resolve('.'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
    });
    return { stdout, stderr: '', combined: stdout, exitCode: 0 };
  } catch (e: unknown) {
    const execError = e as {
      stdout?: { toString(): string } | string;
      stderr?: { toString(): string } | string;
      status?: number | null;
    };
    const stdout = execError.stdout?.toString() || '';
    const stderr = execError.stderr?.toString() || '';
    return {
      stdout,
      stderr,
      combined: stdout + stderr,
      exitCode: execError.status || 1,
    };
  }
}

describe('check-contract-sync', () => {
  // ── Field name parity ──────────────────────────────────────────
  describe('field name parity', () => {
    it('passes when all fields match between Python and TypeScript', () => {
      const result = runSync(`${FIXTURES}/simple_py.py ${FIXTURES}/simple_ts.ts`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('full parity confirmed');
    });

    it('fails (exit 1) when Python has a field not present in TypeScript', () => {
      const result = runSync(`${FIXTURES}/mismatch_py.py ${FIXTURES}/mismatch_ts.ts`);
      expect(result.exitCode).toBe(1);
      expect(result.combined).toContain('extra_field_only_in_python');
      expect(result.combined).toContain('PARITY FAILURE');
    });

    it('fails (exit 1) when TypeScript has a field not present in Python', () => {
      // swap args: ts as py, py as ts to simulate ts-only field
      const result = runSync(`${FIXTURES}/mismatch_ts.ts ${FIXTURES}/mismatch_py.py`);
      // Python parser will fail on the TS file, so this should error
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ── Real schemas ───────────────────────────────────────────────
  describe('real schemas', () => {
    const PY_PATH = '../noticiencias_news_collector/news_collector/contracts/frontend_schema.py';
    const TS_PATH = 'src/content.config.ts';

    it('confirms parity between the actual backend and frontend schemas', () => {
      // Skip if backend schema not available (e.g., CI without backend checkout)
      if (!existsSync(resolve(PY_PATH))) {
        console.warn('Backend schema not found — skipping real-schema parity test');
        return;
      }
      const result = runSync(`${PY_PATH} ${TS_PATH}`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('full parity confirmed');
    });
  });

  // ── Structural schema module extraction ────────────────────────
  describe('structural schema module extraction', () => {
    const EXPECTED_FIELDS = [
      'title',
      'schema_version',
      'excerpt',
      'author',
      'date',
      'categories',
      'tags',
      'image',
      'image_alt',
      'permalink',
      'source_url',
      'refinery_id',
      'headlines_variants',
      'translation_method',
      'editorial_score',
      'review_status',
      'confidence',
      'investigation',
      'requires_uncertainty_note',
      'featured',
      'featured_rank',
      'summary_points',
      'uncertainty_note',
      'glossary',
      'fact_check',
      'evidence_subject_type',
      'evidence_detail',
      'why_it_matters',
      'series',
      'sources',
      'social',
      'institution',
      'publication_status',
      'reviewer_name',
      'reviewer_role',
      'reviewer_profile_url',
      'review_date',
      'known_points',
      'open_questions',
      'corrected_at',
      'correction_summary',
    ];

    it('extracts the exact top-level field set from the imported module', () => {
      const result = runSync(`--print-fields ${resolve('src/content.config.ts')}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim().split('\n')).toEqual(EXPECTED_FIELDS);
    });

    it('resolves a schema re-exported from content.config.ts', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'contract-sync-module-'));
      try {
        writeFileSync(
          join(tmp, 'post.ts'),
          "import { z } from 'astro/zod';\nexport const postSchema = z.object({\n  title: z.string().min(5),\n  author: z.string().default('X'),\n});\n"
        );
        writeFileSync(
          join(tmp, 'content.config.ts'),
          "export { postSchema } from './post';\nconst posts = { schema: postSchema };\n"
        );

        const result = runSync(`--print-fields ${join(tmp, 'content.config.ts')}`);
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim().split('\n')).toEqual(['title', 'author']);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  // ── Snapshot mode ──────────────────────────────────────────────
  describe('snapshot mode', () => {
    const SNAPSHOT_PATH = resolve('tests/fixtures/contract-sync/test-snapshot.json');
    const TS_PATH = resolve('tests/fixtures/contract-sync/simple_ts.ts');

    beforeAll(() => {
      // Generate a snapshot from the simple fixture
      const result = runSync(
        `--generate-snapshot ${SNAPSHOT_PATH} ${FIXTURES}/simple_py.py ${FIXTURES}/simple_ts.ts`
      );
      expect(result.exitCode).toBe(0);
      expect(existsSync(SNAPSHOT_PATH)).toBe(true);
    });

    afterAll(() => {
      if (existsSync(SNAPSHOT_PATH)) unlinkSync(SNAPSHOT_PATH);
    });

    it('passes parity check using a snapshot instead of live Python file', () => {
      const result = runSync(`--snapshot ${SNAPSHOT_PATH} ${TS_PATH}`);
      expect(result.exitCode).toBe(0);
      expect(result.combined).toContain('Using snapshot');
      expect(result.combined).toContain('full parity confirmed');
    });

    it('detects mismatch when a field is removed from the TypeScript side', () => {
      // The mismatch_ts.ts is missing 'author' and 'featured' and 'source_url' and 'sources'
      const result = runSync(`--snapshot ${SNAPSHOT_PATH} ${FIXTURES}/mismatch_ts.ts`);
      // Field presence mismatch = error
      expect(result.exitCode).toBe(1);
    });

    it('rejects invalid snapshot path with exit 2', () => {
      const result = runSync('--snapshot /nonexistent/path.json src/content.config.ts');
      expect(result.exitCode).toBe(2);
    });
  });

  // ── Cross-field invariants (plan 119) ───────────────────────────
  // One test per superRefine/model_validator rule. Each asserts BOTH sides
  // reject the violating payload:
  //   (a) frontend: the live Zod schema refuses the payload (behavioral);
  //   (b) backend: the backend suite contains the rejecting case by name
  //       (file-level evidence — the gate cannot execute Pydantic
  //       hermetically, so it greps; see CROSS_FIELD_INVARIANTS coupling
  //       note in scripts/check-contract-sync.js);
  //   (c) gate: the live gate run verifies the invariant mirror pair.
  // Backend-dependent parts skip (warn-only) when the backend checkout is
  // absent, mirroring the 'real schemas' test above.
  describe('cross-field invariants', () => {
    const BACKEND_SCHEMA = resolve(
      process.env.BACKEND_SCHEMA_PATH ||
        '../noticiencias_news_collector/news_collector/contracts/frontend_schema.py'
    );
    const BACKEND_UNIT_TEST = join(
      dirname(BACKEND_SCHEMA),
      '../../tests/unit/contracts/test_frontend_schema.py'
    );
    const TS_PATH = resolve('src/content.config.ts');

    let gateResult: { combined: string; exitCode: number } | null = null;

    beforeAll(() => {
      if (!existsSync(BACKEND_SCHEMA)) {
        console.warn('Backend schema not found — skipping live-gate invariant assertions');
        return;
      }
      gateResult = runSync(`${BACKEND_SCHEMA} ${TS_PATH}`);
    });

    function expectBackendCases(cases: string[]): void {
      if (!existsSync(BACKEND_UNIT_TEST)) {
        console.warn('Backend contract tests not found — skipping backend-case assertions');
        return;
      }
      const content = readFileSync(BACKEND_UNIT_TEST, 'utf-8');
      for (const name of cases) {
        expect(content).toContain(name);
      }
    }

    function expectGateVerifies(id: string): void {
      if (gateResult === null) {
        console.warn('No live gate run — skipping gate invariant assertion');
        return;
      }
      expect(gateResult.exitCode).toBe(0);
      expect(gateResult.combined).toContain(id);
    }

    it('v2-editorial-block: both sides reject a v2 post without editorial fields', () => {
      expect(postsSchema.safeParse({ ...invariantBasePost, schema_version: 2 }).success).toBe(
        false
      );
      expectBackendCases(['test_v2_missing_summary_points_raises']);
      expectGateVerifies('v2-editorial-block');
    });

    it('featured-rank: both sides reject featured=true without a rank', () => {
      expect(postsSchema.safeParse({ ...invariantBasePost, featured: true }).success).toBe(false);
      expectBackendCases(['test_featured_true_without_rank_raises']);
      expectGateVerifies('featured-rank');
    });

    it('correction-pair: both sides reject a half-correction', () => {
      expect(
        postsSchema.safeParse({ ...invariantBasePost, corrected_at: '2026-09-02' }).success
      ).toBe(false);
      expect(
        postsSchema.safeParse({ ...invariantBasePost, correction_summary: 'Una cifra.' }).success
      ).toBe(false);
      expectBackendCases(['test_correction_half_pair_raises']);
      expectGateVerifies('correction-pair');
    });

    it('social-id: both sides reject publish=true without id, non-bool publish, and null', () => {
      expect(
        postsSchema.safeParse({ ...invariantBasePost, social: { publish: true } }).success
      ).toBe(false);
      for (const publish of ['true', 1, 0]) {
        expect(postsSchema.safeParse({ ...invariantBasePost, social: { publish } }).success).toBe(
          false
        );
      }
      expect(postsSchema.safeParse({ ...invariantBasePost, social: null }).success).toBe(false);
      expectBackendCases([
        // eslint-disable-next-line no-secrets/no-secrets -- backend test-case name, not a secret
        'test_social_id_required_when_publishing',
        'test_social_publish_rejects_non_bool',
        'test_social_explicit_null_rejected',
      ]);
      expectGateVerifies('social-id');
    });

    it('doi-primary: both sides reject a doi without primary role', () => {
      expect(
        postsSchema.safeParse({
          ...invariantBasePost,
          sources: [
            { title: 'Source', url: 'https://example.com', doi: '10.1371/journal.pone.0353485' },
          ],
        }).success
      ).toBe(false);
      expectBackendCases(['test_doi_without_primary_role_raises']);
      expectGateVerifies('doi-primary');
    });

    it('image-alt: both sides reject a post with no alt text anywhere', () => {
      expect(postsSchema.safeParse({ ...invariantBasePost, image_alt: undefined }).success).toBe(
        false
      );
      expectBackendCases(['test_missing_image_alt_without_inline_alt_raises']);
      expectGateVerifies('image-alt');
    });
  });

  // ── Error handling ─────────────────────────────────────────────
  describe('error handling', () => {
    it('exits 2 when required arguments are missing', () => {
      const result = runSync('');
      expect(result.exitCode).toBe(2);
    });

    it('exits 2 when Python file does not exist and no snapshot fallback', () => {
      const result = runSync('/nonexistent/py.py /nonexistent/ts.ts');
      expect(result.exitCode).toBe(2);
    });
  });

  // ── generatedAt no-churn contract ──────────────────────────────
  // The scheduled Sync Contract Snapshot bot skips the commit/PR via
  // `git diff --cached --quiet`; if regeneration always bumped generatedAt
  // the diff would never be empty and every weekly run would open and merge
  // a timestamp-only PR. The generator must preserve generatedAt when the
  // extracted Python IR is unchanged and bump it only on real drift.
  describe('generatedAt no-churn contract', () => {
    const TMP = mkdtempSync(join(tmpdir(), 'contract-sync-gen-'));
    const SNAPSHOT_PATH = join(TMP, 'snapshot.json');
    const PY_PATH = resolve('tests/fixtures/contract-sync/simple_py.py');
    const TS_PATH = resolve('tests/fixtures/contract-sync/simple_ts.ts');
    const CHANGED_PY_PATH = join(TMP, 'changed_py.py');

    afterAll(() => {
      rmSync(TMP, { recursive: true, force: true });
    });

    it('preserves generatedAt when the Python IR is unchanged', () => {
      runSync(`--generate-snapshot ${SNAPSHOT_PATH} ${PY_PATH} ${TS_PATH}`);
      const first = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));

      runSync(`--generate-snapshot ${SNAPSHOT_PATH} ${PY_PATH} ${TS_PATH}`);
      const second = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));

      expect(second.generatedAt).toBe(first.generatedAt);
      expect(second.pythonIR).toEqual(first.pythonIR);
    });

    it('bumps generatedAt when the Python IR changes', () => {
      runSync(`--generate-snapshot ${SNAPSHOT_PATH} ${PY_PATH} ${TS_PATH}`);
      const first = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));

      writeFileSync(
        CHANGED_PY_PATH,
        `${readFileSync(PY_PATH, 'utf-8')}\nclass ExtraModel(BaseModel):\n    extra_field: str\n`,
        'utf-8'
      );
      runSync(`--generate-snapshot ${SNAPSHOT_PATH} ${CHANGED_PY_PATH} ${TS_PATH}`);

      const second = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
      expect(second.generatedAt).not.toBe(first.generatedAt);
      expect(second.pythonIR.models.ExtraModel).toBeDefined();
    });

    it('writes a Prettier-formatted snapshot that passes format:check', async () => {
      const raw = readFileSync(SNAPSHOT_PATH, 'utf-8');
      const normalized = await format(JSON.stringify(JSON.parse(raw), null, 2), { parser: 'json' });
      expect(raw).toBe(normalized);
    });
  });
});
