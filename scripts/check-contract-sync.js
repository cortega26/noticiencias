#!/usr/bin/env node
/**
 * check-contract-sync.js
 *
 * Validates that the top-level field names in the backend AstroPost Pydantic model
 * match the top-level field names in the frontend Zod schema (src/content/config.ts).
 *
 * Mirrors the logic in noticiencias_news_collector/tests/test_contracts_sync.py.
 *
 * Usage:
 *   node scripts/check-contract-sync.js <path-to-frontend_schema.py> <path-to-config.ts>
 *
 * Exit codes:
 *   0 — field parity confirmed
 *   1 — parity failure (fields present in one side but not the other)
 *   2 — usage error or file not found
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const [, , pyPathArg, tsPathArg] = process.argv;
if (!pyPathArg || !tsPathArg) {
  console.error('Usage: node scripts/check-contract-sync.js <frontend_schema.py> <config.ts>');
  process.exit(2);
}

const pyPath = resolve(pyPathArg);
const tsPath = resolve(tsPathArg);

let pySource, tsSource;
try {
  pySource = readFileSync(pyPath, 'utf-8');
} catch (e) {
  console.error(`Cannot read Python schema: ${pyPath}\n${e.message}`);
  process.exit(2);
}
try {
  tsSource = readFileSync(tsPath, 'utf-8');
} catch (e) {
  console.error(`Cannot read TypeScript schema: ${tsPath}\n${e.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Extract AstroPost top-level field names from the Python Pydantic model.
// Matches lines like:
//     title: str = Field(...)
//     schema_version: int = Field(...)
//     categories: List[str] = ...
// inside the AstroPost class body (4-space indent).
// Excludes dunder methods, validators, and class-level descriptors.
// ---------------------------------------------------------------------------
const SKIP_PY = new Set(['model_config', 'model_fields', 'model_computed_fields']);

function extractPythonFields(source) {
  // Locate the AstroPost class
  const classStart = source.indexOf('class AstroPost(');
  if (classStart === -1) {
    throw new Error('Could not find "class AstroPost(" in the Python file.');
  }
  const body = source.slice(classStart);
  const fields = new Set();
  // Match 4-space-indented type-annotated lines that are NOT methods/validators
  const re =
    /^ {4}(\w+)\s*:\s*(?:Optional|Union|List|str|int|float|bool|dt_date|dt_datetime|HttpUrl)/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const name = m[1];
    if (!name.startsWith('_') && !SKIP_PY.has(name)) {
      fields.add(name);
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Extract top-level Zod field names from config.ts.
// Matches lines like:
//       title: z.string().min(5, 'Title too short'),
//       schema_version: z.number().int().min(1).default(1),
// The 6-space indent is enforced by the CI formatter (confirmed in test_contracts_sync.py).
// ---------------------------------------------------------------------------
function extractTypeScriptFields(source) {
  const fields = new Set();
  // Match 6-space-indented top-level Zod fields. The value may be:
  //   fieldName: z.string()...   (inline)
  //   fieldName: z               (multiline, z is followed by newline then chain)
  const re = /^ {6}(\w+)\s*:\s*z(?:\.|$)/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    fields.add(m[1]);
  }
  return fields;
}

let pyFields, tsFields;
try {
  pyFields = extractPythonFields(pySource);
} catch (e) {
  console.error(`Failed to parse Python schema: ${e.message}`);
  process.exit(2);
}
tsFields = extractTypeScriptFields(tsSource);

if (pyFields.size === 0) {
  console.error('No fields extracted from AstroPost — check regex or file format.');
  process.exit(2);
}
if (tsFields.size === 0) {
  console.error('No fields extracted from config.ts — check regex or file format.');
  process.exit(2);
}

const onlyInPy = [...pyFields].filter((f) => !tsFields.has(f)).sort();
const onlyInTs = [...tsFields].filter((f) => !pyFields.has(f)).sort();

if (onlyInPy.length || onlyInTs.length) {
  if (onlyInPy.length) {
    console.error(
      `[contract-sync] Fields in AstroPost (Python) but NOT in config.ts (TypeScript):\n  ${onlyInPy.join('\n  ')}`
    );
  }
  if (onlyInTs.length) {
    console.error(
      `[contract-sync] Fields in config.ts (TypeScript) but NOT in AstroPost (Python):\n  ${onlyInTs.join('\n  ')}`
    );
  }
  console.error(
    '\n[contract-sync] PARITY FAILURE. See docs/PIPELINE_CONTRACTS.md and ADR-0003 for the coordinated change protocol.'
  );
  process.exit(1);
}

console.log(
  `[contract-sync] OK — ${pyFields.size} fields matched between AstroPost and config.ts.`
);
