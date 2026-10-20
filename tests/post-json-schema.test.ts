/**
 * Plan 175 / plan 060 Phase 6: generated post JSON Schema and Zod/Ajv parity.
 *
 * The neutral artifact is generated from `postStructuralSchema` (plan 174),
 * not from the Astro collection schema: `src/content.config.ts` adds semantic
 * `superRefine` rules, which `z.toJSONSchema()` cannot represent. The
 * structural/semantic split is deliberate; the corpus README records the
 * limits.
 *
 * Date handling is explicit. `z.date()` has no JSON Schema equivalent, so a
 * single `unrepresentable` handler maps the `date` property to
 * `oneOf: [date, date-time]` — matching the corpus (date-only strings) and
 * Pydantic's `Union[date, datetime]`. Any other unrepresentable node still
 * fails generation; `unrepresentable: "any"` is forbidden by plan 060.
 *
 * The corpus stores raw frontmatter strings. Astro's content loader parses an
 * unquoted `YYYY-MM-DD` as a `Date` before the Zod schema sees it, so the Zod
 * assertions below convert the string to an explicit UTC `Date` first. The
 * JSON Schema side validates the raw string, as a neutral consumer would.
 *
 * Regenerate with `npm run schema:update` (writes src/schemas/post.schema.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { z } from 'astro/zod';
import * as prettier from 'prettier';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config,
}));

import { collections } from '../src/content.config';
import { postStructuralSchema } from '../src/schemas/post';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');
const CORPUS_DIR = path.join(TEST_DIR, 'fixtures', 'publication-contract-corpus');
const SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'schemas', 'post.schema.json');

const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const SCHEMA_TITLE = 'Noticiencias post frontmatter (structural)';

/** Neutral representation of `date`; see the header comment. */
const DATE_JSON_SCHEMA = {
  oneOf: [
    { type: 'string' as const, format: 'date' },
    { type: 'string' as const, format: 'date-time' },
  ],
};

/** Locale-independent key ordering: committed bytes must not vary by machine. */
function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      compareKeys(a, b)
    );
    return Object.fromEntries(entries.map(([key, child]) => [key, sortJsonKeys(child)]));
  }
  return value;
}

function buildPostJsonSchema(): Record<string, unknown> {
  const generated = JSON.parse(
    JSON.stringify(
      z.toJSONSchema(postStructuralSchema, {
        target: 'draft-2020-12',
        // Validate frontmatter input, so `.default(...)` fields stay optional.
        io: 'input',
        unrepresentable: (ctx) => {
          if (ctx.zodSchema instanceof z.ZodDate && ctx.path.join('.') === 'properties.date') {
            return DATE_JSON_SCHEMA;
          }
          // Never degrade an unexpected node to `{}`.
          return 'throw';
        },
      })
    )
  ) as Record<string, unknown>;

  const canonical = sortJsonKeys({
    ...generated,
    $schema: DRAFT_2020_12,
    title: SCHEMA_TITLE,
  }) as Record<string, unknown>;

  // Fixed top-level keyword order for reviewability; nested objects are key
  // sorted above. `required` is a set, so sort it too.
  const topLevel = ['$schema', 'title', 'type', 'properties', 'required', 'additionalProperties'];
  const ordered: Record<string, unknown> = {};
  for (const key of topLevel) {
    if (key in canonical) ordered[key] = canonical[key];
  }
  for (const key of Object.keys(canonical).sort(compareKeys)) {
    if (!(key in ordered)) ordered[key] = canonical[key];
  }
  if (Array.isArray(ordered.required)) {
    ordered.required = [...(ordered.required as string[])].sort(compareKeys);
  }
  return ordered;
}

async function serialize(schema: Record<string, unknown>): Promise<string> {
  // Same formatter/config as `npm run format:check`, so the committed file is
  // byte-stable and never fights Prettier.
  return prettier.format(JSON.stringify(schema), { parser: 'json', filepath: SCHEMA_PATH });
}

function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, relativePath), 'utf8'));
}

function readObject(relativePath: string): Record<string, unknown> {
  return readJson(relativePath) as Record<string, unknown>;
}

/**
 * Astro parses `date: 2026-01-15` into a `Date` before schema validation.
 * Pin UTC explicitly so the conversion is timezone-independent.
 */
function toAstroFrontmatter(fixture: Record<string, unknown>): Record<string, unknown> {
  const { date, ...rest } = fixture;
  if (typeof date !== 'string') {
    throw new Error(`fixture date must be a string, received ${typeof date}`);
  }
  return { ...rest, date: new Date(`${date}T00:00:00.000Z`) };
}

const GENERATED_SCHEMA = buildPostJsonSchema();
const GENERATED_PROPERTIES = GENERATED_SCHEMA.properties as Record<string, Record<string, unknown>>;

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateWithAjv = ajv.compile(GENERATED_SCHEMA);

function ajvFailure(): string {
  return JSON.stringify(validateWithAjv.errors ?? [], null, 2);
}

const postsSchema = (collections.posts as unknown as { schema: z.ZodType }).schema;

const VALID_FIXTURES: string[] = [
  'valid/v1-complete.json',
  'valid/v2-complete.json',
  'edge-cases/defaults.json',
  'edge-cases/additional-property-stripped.json',
];

/**
 * Fixtures the structural artifact can reject. Everything else under
 * `invalid/` is rejected by a `superRefine` rule that JSON Schema cannot
 * encode, or (one case) is not actually invalid under the current contract.
 */
const STRUCTURALLY_INVALID: string[] = [
  'v2-empty-summary-points.json',
  'v2-too-many-summary-points.json',
];

/** Fixture -> field whose v2 requirement the full posts schema enforces. */
const SEMANTIC_ONLY_INVALID: Array<[fixture: string, field: string]> = [
  ['v2-missing-confidence.json', 'confidence'],
  ['v2-missing-fact-check.json', 'fact_check'],
  ['v2-missing-glossary.json', 'glossary'],
  ['v2-missing-sources.json', 'sources'],
  ['v2-missing-summary-points.json', 'summary_points'],
];

/**
 * Frozen corpus correction: P0-06 / DEC-003 gives `why_it_matters` no minimum,
 * so this fixture is valid under `postStructuralSchema`, the full posts schema
 * **and** Pydantic. It stays in `invalid/` because fixtures are frozen; the
 * README records the correction and this test pins the actual behavior.
 */
const KNOWN_MISLABELED_VALID: string[] = ['v2-missing-why-it-matters.json'];

describe('generated post JSON Schema', () => {
  it('committed artifact matches the generated schema', async () => {
    const expected = await serialize(GENERATED_SCHEMA);
    if (process.env.UPDATE_SCHEMA === '1') {
      fs.writeFileSync(SCHEMA_PATH, expected, 'utf8');
    }

    expect(fs.existsSync(SCHEMA_PATH), `missing ${SCHEMA_PATH}; run npm run schema:update`).toBe(
      true
    );
    expect(fs.readFileSync(SCHEMA_PATH, 'utf8')).toBe(expected);
  });

  it('is deterministic across repeated generation', async () => {
    const first = await serialize(buildPostJsonSchema());
    const second = await serialize(buildPostJsonSchema());
    expect(first).toBe(second);
  });

  it('targets the 2020-12 dialect with a title', () => {
    expect(GENERATED_SCHEMA.$schema).toBe(DRAFT_2020_12);
    expect(GENERATED_SCHEMA.title).toBe(SCHEMA_TITLE);
    expect(GENERATED_SCHEMA.type).toBe('object');
  });

  it('represents date as a date/date-time oneOf', () => {
    expect(GENERATED_PROPERTIES.date).toEqual(DATE_JSON_SCHEMA);
  });

  it('allows additional top-level properties', () => {
    expect('additionalProperties' in GENERATED_SCHEMA).toBe(false);
  });

  it('keeps social strict, mirroring the Zod `.strict()` and Pydantic extra="forbid"', () => {
    expect(GENERATED_PROPERTIES.social.additionalProperties).toBe(false);
  });

  it('requires only non-defaulted input fields', () => {
    expect(GENERATED_SCHEMA.required).toEqual(['date', 'excerpt', 'image', 'title']);
  });
});

describe('corpus: valid fixtures', () => {
  describe.each(VALID_FIXTURES)('%s', (fixture) => {
    it('validates against the JSON Schema', () => {
      const data = readJson(fixture);
      expect(validateWithAjv(data), ajvFailure()).toBe(true);
    });

    it('passes the structural Zod schema', () => {
      const parsed = postStructuralSchema.safeParse(toAstroFrontmatter(readObject(fixture)));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it('passes the full posts schema', () => {
      const parsed = postsSchema.safeParse(toAstroFrontmatter(readObject(fixture)));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  });

  it('accepts the source-objects edge case substituted into v2-complete', () => {
    const v2 = readObject('valid/v2-complete.json');
    const data = { ...v2, sources: readJson('edge-cases/source-objects.json') };

    expect(validateWithAjv(data), ajvFailure()).toBe(true);
    expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
    expect(postsSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
  });

  it('strips the unknown property when Astro parses the extra-property fixture', () => {
    const fixture = readObject('edge-cases/additional-property-stripped.json');
    const parsed = postsSchema.safeParse(toAstroFrontmatter(fixture));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('not_a_real_field');
    }
  });
});

describe('corpus: invalid fixtures', () => {
  it('classifies every invalid fixture exactly once', () => {
    const all = fs
      .readdirSync(path.join(CORPUS_DIR, 'invalid'))
      .filter((name) => name.endsWith('.json'))
      .sort(compareKeys);
    const classified = [
      ...STRUCTURALLY_INVALID,
      ...SEMANTIC_ONLY_INVALID.map(([fixture]) => fixture),
      ...KNOWN_MISLABELED_VALID,
    ].sort(compareKeys);

    expect(classified).toEqual(all);
    expect(new Set(classified).size).toBe(classified.length);
  });

  describe.each(STRUCTURALLY_INVALID)('%s', (fixture) => {
    it('is rejected by the JSON Schema and by structural Zod', () => {
      const data = readObject(`invalid/${fixture}`);
      expect(validateWithAjv(data), ajvFailure()).toBe(false);
      expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(false);
    });
  });

  describe.each(SEMANTIC_ONLY_INVALID)('%s', (fixture, field) => {
    it('is a named representation gap: structural Zod and Ajv accept, the full schema rejects', () => {
      const data = readObject(`invalid/${fixture}`);

      // The superRefine v2 block is not encodable as JSON Schema. Zod
      // (structural) and Ajv therefore agree on this fixture; the full
      // collection contract is what rejects it.
      expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
      expect(validateWithAjv(data), ajvFailure()).toBe(true);

      const parsed = postsSchema.safeParse(toAstroFrontmatter(data));
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.map((issue) => issue.path[0])).toContain(field);
    });
  });

  describe.each(KNOWN_MISLABELED_VALID)('%s', (fixture) => {
    it('is valid under every contract despite its invalid/ path', () => {
      const data = readObject(`invalid/${fixture}`);
      expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
      expect(validateWithAjv(data), ajvFailure()).toBe(true);
      expect(postsSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
    });
  });

  it('does not encode the http(s)-only source URL refinement (named limit)', () => {
    const v2 = readObject('valid/v2-complete.json');
    const sources = v2.sources as Array<Record<string, unknown>>;
    const data = {
      ...v2,
      sources: [{ ...sources[0], url: 'ftp://example.com/article' }],
    };

    // JSON Schema `format: uri` accepts any scheme; both Zod contracts (and
    // Pydantic's HttpUrl) reject non-http(s) source URLs.
    expect(validateWithAjv(data), ajvFailure()).toBe(true);
    expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(false);
    expect(postsSchema.safeParse(toAstroFrontmatter(data)).success).toBe(false);
  });
});

describe('corpus: date-format substitution', () => {
  const v2 = readObject('valid/v2-complete.json');
  const dates = readJson('edge-cases/date-formats.json') as string[];

  it('has at least one recorded format', () => {
    expect(dates.length).toBeGreaterThan(0);
  });

  it.each(dates)('accepts %s substituted into v2-complete', (date) => {
    const data = { ...v2, date };
    expect(validateWithAjv(data), ajvFailure()).toBe(true);
    expect(postStructuralSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
    expect(postsSchema.safeParse(toAstroFrontmatter(data)).success).toBe(true);
  });
});
