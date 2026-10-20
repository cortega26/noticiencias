#!/usr/bin/env node
/**
 * check-contract-sync.js
 *
 * Validates that the backend AstroPost Pydantic model matches the frontend
 * Zod schema (src/content.config.ts). Compares field names, types, constraints,
 * optionality, defaults, and nested model structures, plus cross-field rule
 * mirrors (superRefine/model_validator presence per CROSS_FIELD_INVARIANTS).
 *
 * Usage:
 *   node scripts/check-contract-sync.js <path-to-frontend_schema.py> <path-to-config.ts>
 *   node scripts/check-contract-sync.js --strict <path-to-frontend_schema.py> <path-to-config.ts>
 *   node scripts/check-contract-sync.js --snapshot <snapshot.json> <path-to-config.ts>
 *   node scripts/check-contract-sync.js --generate-snapshot <out.json> <py-path> <ts-path>
 *
 * Exit codes:
 *   0 — parity confirmed (may include warnings in V1 mode; no warnings in --strict)
 *   1 — parity failure (field presence mismatch, or any mismatch in --strict mode)
 *   2 — usage error or file not found
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { format } from 'prettier';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let mode = 'compare'; // 'compare' | 'snapshot' | 'generate-snapshot'
let strictMode = false;
let printFields = false;
let pyPath, tsPath, snapshotPath, generatePath;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--snapshot') {
    mode = 'snapshot';
    snapshotPath = args[++i];
  } else if (args[i] === '--generate-snapshot') {
    mode = 'generate-snapshot';
    generatePath = args[++i];
  } else if (args[i] === '--strict') {
    strictMode = true;
  } else if (args[i] === '--print-fields') {
    printFields = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`Usage:
  node check-contract-sync.js <frontend_schema.py> <config.ts>
  node check-contract-sync.js --strict <frontend_schema.py> <config.ts>
  node check-contract-sync.js --snapshot <snapshot.json> <config.ts>
  node check-contract-sync.js --generate-snapshot <out.json> <frontend_schema.py> <config.ts>
  node check-contract-sync.js --print-fields <config.ts>`);
    process.exit(0);
  } else if (!pyPath && mode !== 'snapshot') {
    pyPath = args[i];
  } else if (!pyPath && mode === 'snapshot') {
    pyPath = args[i]; // snapshot mode: first positional is config.ts
  } else if (!tsPath) {
    tsPath = args[i];
  }
}

// In snapshot mode, the first positional is the ts path
if (mode === 'snapshot') {
  tsPath = pyPath;
  pyPath = null;
}

// --print-fields only needs the TypeScript config path.
if (printFields) {
  tsPath = tsPath || pyPath;
  pyPath = null;
}

if (printFields && !tsPath) {
  console.error('Usage: node scripts/check-contract-sync.js --print-fields <config.ts>');
  process.exit(2);
}

if (!printFields && (mode === 'compare' || mode === 'generate-snapshot') && (!pyPath || !tsPath)) {
  console.error('Usage: node scripts/check-contract-sync.js <frontend_schema.py> <config.ts>');
  console.error(
    '       node scripts/check-contract-sync.js --snapshot <snapshot.json> <config.ts>'
  );
  console.error(
    '       node scripts/check-contract-sync.js --generate-snapshot <out.json> <py-path> <ts-path>'
  );
  console.error('       node scripts/check-contract-sync.js --print-fields <config.ts>');
  process.exit(2);
}

if (mode === 'snapshot' && (!snapshotPath || !tsPath)) {
  console.error(
    'Usage: node scripts/check-contract-sync.js --snapshot <snapshot.json> <config.ts>'
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// IR (Intermediate Representation) types (documented in comments)
//
// FieldIR = {
//   name: string,
//   type: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'array' | 'object' | 'union',
//   optional: boolean,
//   default: any | undefined,
//   constraints: { minLength?, maxLength?, min?, max?, integer?, positive? },
//   unionTypes?: string[],           // for union
//   nestedModel?: string,            // for object
//   itemType?: string,               // for array
//   itemNestedModel?: string,        // for array<object>
//   itemConstraints?: object,        // for array constraints
// }
//
// SchemaIR = {
//   version: 1,
//   source: 'python' | 'typescript' | 'snapshot',
//   generatedAt?: string,
//   backendRef?: string,
//   models: {
//     ModelName: { fields: FieldIR[] }
//   }
// }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Known intentional divergences (always tolerated — warning only, never error,
// including in --strict mode)
// ---------------------------------------------------------------------------

const ALLOWED_DIVERGENCES = [
  {
    path: 'AstroPost.date',
    python: 'Union[date, datetime]',
    typescript: 'date',
    reason: 'Zod z.date() covers both; Pydantic explicitly allows both date and datetime',
  },
  {
    path: 'AstroPost.editorial_score',
    python: 'float',
    typescript: 'number',
    reason: 'Python float and Zod z.number() are runtime-equivalent',
  },
];

function isAllowedDivergence(path, category) {
  return ALLOWED_DIVERGENCES.some(
    (d) => d.path === path && (category === 'type_mismatch' || category === 'constraint_mismatch')
  );
}

// ---------------------------------------------------------------------------
// Cross-field rule invariants (plan 119)
//
// compareFields above sees only type/optionality/default/min/max — it can
// never observe superRefine (Zod) / model_validator (Pydantic) rules, so CI
// stayed green while the schemas diverged in exactly the build-breaking
// dimension. This table enumerates one invariant per cross-field rule. The
// gate asserts file-level evidence (literal marker strings present in BOTH
// sources) rather than re-implementing Pydantic/Zod semantics in the gate.
//
// Coupling (brittle but explicit): each entry names the rejecting test cases
// on both sides. Backend cases live in
// tests/unit/contracts/test_frontend_schema.py in the backend repo;
// frontend cases live in tests/content-config-schema.test.ts, and the
// both-sides assertions live in tests/contract-sync.test.ts
// ("cross-field invariants"). If a case is renamed, update this table and
// the contract-sync test together.
//
// Marker hygiene: pythonMarkers use `def <name>(` (not the bare function
// name) and full message strings so that a rename/extension of the validator
// cannot hide behind a substring match.
// ---------------------------------------------------------------------------

const CROSS_FIELD_INVARIANTS = [
  {
    id: 'v2-editorial-block',
    title: 'schema_version >= 2 requires summary_points/glossary/fact_check/confidence/sources',
    pythonMarkers: [
      'def _v2_editorial_fields_required(',
      'summary_points is required for schema_version >= 2',
    ],
    tsMarkers: ['schema_version >= 2', 'summary_points is required for schema_version >= 2'],
    backendCases: ['test_v2_missing_summary_points_raises'],
    frontendCases: ['rejects a v2 post missing every editorial field'],
  },
  {
    id: 'featured-rank',
    title: 'featured === true requires featured_rank',
    pythonMarkers: [
      'def _featured_rank_required_when_featured(',
      'featured_rank is required when featured is true',
    ],
    tsMarkers: ['data.featured === true', 'featured_rank is required when featured is true'],
    backendCases: ['test_featured_true_without_rank_raises'],
    frontendCases: ['requires featured_rank when featured is true'],
  },
  {
    id: 'correction-pair',
    title: 'corrected_at and correction_summary travel together',
    pythonMarkers: [
      'def _correction_travels_together(',
      'corrected_at and correction_summary must be set together',
    ],
    tsMarkers: ['corrected_at and correction_summary must be set together'],
    backendCases: ['test_correction_half_pair_raises'],
    frontendCases: ['accepts a complete correction and rejects half-corrections'],
  },
  {
    id: 'social-id',
    title: 'social.publish === true requires non-empty id; publish is strict bool; null rejected',
    pythonMarkers: [
      'def _id_required_when_publishing(',
      'social.id is required and non-empty when social.publish is true',
      'def _publish_must_be_bool(',
      'def _social_not_null(',
    ],
    tsMarkers: [
      'social.id is required and non-empty when social.publish is true',
      'publish: z.boolean()',
    ],
    backendCases: [
      // eslint-disable-next-line no-secrets/no-secrets -- backend test-case name, not a secret
      'test_social_id_required_when_publishing',
      'test_social_publish_rejects_non_bool',
      'test_social_explicit_null_rejected',
    ],
    frontendCases: [
      'requires a non-empty social.id when social.publish is true',
      'rejects a non-boolean social.publish (no "true" / 1 / 0 coercion)',
      'rejects an explicit social: null',
    ],
  },
  {
    id: 'doi-primary',
    title: 'sources with doi must declare role: primary',
    pythonMarkers: [
      'def _doi_requires_primary_role(',
      'sources with doi must declare role: primary',
    ],
    tsMarkers: ["source.role !== 'primary'", 'sources with doi must declare role: primary'],
    backendCases: ['test_doi_without_primary_role_raises'],
    frontendCases: ['rejects a DOI without primary role'],
  },
  {
    id: 'image-alt',
    title: 'image_alt required when image carries no inline alt text',
    pythonMarkers: [
      'def ensure_alt_text_contract(',
      'image_alt is required when image does not provide inline alt text',
    ],
    tsMarkers: ['image_alt is required when image does not include inline alt text'],
    backendCases: ['test_missing_image_alt_without_inline_alt_raises'],
    frontendCases: ['rejects a post whose image has no alt text anywhere'],
  },
];

// ---------------------------------------------------------------------------
// Python schema parser
// ---------------------------------------------------------------------------

const SKIP_PY_FIELDS = new Set(['model_config', 'model_fields', 'model_computed_fields']);

/**
 * Resolve a constant value from the module-level constants map.
 */
function resolvePyConstant(value, constants) {
  const trimmed = value.trim();
  if (constants[trimmed] !== undefined) {
    return constants[trimmed];
  }
  // Parse simple literals
  if (trimmed === 'None') return undefined;
  if (trimmed === 'True') return true;
  if (trimmed === 'False') return false;
  if (trimmed === '...') return undefined; // Ellipsis = required
  if (trimmed === '[]' || trimmed === 'list') return [];
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  if (/^["'].*["']$/.test(trimmed)) return trimmed.slice(1, -1);
  return trimmed; // unresolved symbol, keep as string
}

/**
 * Parse a Python type annotation string into the IR type components.
 * Returns { type, optional, unionTypes, nestedModel, itemType, itemNestedModel }
 */
function parsePythonType(typeStr) {
  typeStr = typeStr.trim();
  const result = {
    type: 'string',
    optional: false,
    unionTypes: null,
    nestedModel: null,
    itemType: null,
    itemNestedModel: null,
    isInteger: false,
  };

  // Optional[X]
  let inner = typeStr;
  if (/^Optional\[(.+)\]$/.test(inner)) {
    result.optional = true;
    inner = inner.match(/^Optional\[(.+)\]$/)[1].trim();
  }

  // Union[A, B]
  if (/^Union\[(.+)\]$/.test(inner)) {
    const branches = inner
      .match(/^Union\[(.+)\]$/)[1]
      .split(',')
      .map((s) => s.trim());
    result.type = 'union';
    result.unionTypes = branches.map((b) => mapPythonBaseType(b));
    // If one branch is a model name, it's the nestedModel for the object branch
    const modelBranch = branches.find(
      (b) =>
        !['str', 'int', 'float', 'bool', 'dt_date', 'dt_datetime', 'HttpUrl', 'None'].includes(b) &&
        !b.startsWith('List[') &&
        !b.startsWith('Optional[')
    );
    if (modelBranch) {
      result.nestedModel = modelBranch;
    }
    return result;
  }

  // List[X]
  if (/^List\[(.+)\]$/.test(inner)) {
    const itemType = inner.match(/^List\[(.+)\]$/)[1].trim();
    result.type = 'array';
    if (['str', 'int', 'float', 'bool'].includes(itemType)) {
      result.itemType = mapPythonBaseType(itemType);
      if (itemType === 'int') result.isInteger = true;
    } else {
      result.itemType = 'object';
      result.itemNestedModel = itemType;
    }
    return result;
  }

  // Base types and model references
  if (inner === 'int') result.isInteger = true;
  result.type = mapPythonBaseType(inner);
  // If the type is not a primitive, it's a nested model reference
  if (!['string', 'number', 'boolean', 'date', 'url'].includes(result.type)) {
    result.nestedModel = inner;
    result.type = 'object';
  }
  return result;
}

function mapPythonBaseType(typeStr) {
  const m = {
    str: 'string',
    int: 'number',
    float: 'number',
    bool: 'boolean',
    dt_date: 'date',
    dt_datetime: 'date',
    HttpUrl: 'url',
  };
  return m[typeStr] || typeStr; // return as-is if unknown (model names)
}

/**
 * Parse Field(...) arguments string into constraints and default.
 */
function parseFieldArgs(argsStr, constants) {
  const constraints = {};
  let defaultValue = undefined;
  let isRequired = false;

  if (!argsStr) return { constraints, defaultValue, isRequired };

  // Find the first comma or equals sign at depth 0.
  // If '=' comes first → all kwargs, no positional arg.
  // If ',' comes first → part before ',' is positional, rest is kwargs.
  // If neither → all positional.
  let depth = 0;
  let splitIdx = -1;
  let splitChar = '';
  for (let i = 0; i < argsStr.length; i++) {
    if (argsStr[i] === '(') depth++;
    if (argsStr[i] === ')') depth--;
    if (depth === 0 && (argsStr[i] === ',' || argsStr[i] === '=')) {
      splitIdx = i;
      splitChar = argsStr[i];
      break;
    }
  }

  let positional = null;
  let kwargsStr = '';

  if (splitIdx >= 0) {
    if (splitChar === '=') {
      // First separator is '=' — all kwargs, no positional
      kwargsStr = argsStr;
    } else {
      // First separator is ',' — part before is positional
      positional = argsStr.slice(0, splitIdx).trim();
      kwargsStr = argsStr.slice(splitIdx + 1).trim();
    }
  } else {
    // No comma or equals — all positional
    positional = argsStr;
  }

  // Process positional arg
  if (positional !== null) {
    if (positional === '...') {
      isRequired = true;
    } else {
      defaultValue = resolvePyConstant(positional, constants);
    }
  }

  // Process kwargs
  if (kwargsStr) {
    Object.assign(constraints, parseFieldKwargs(kwargsStr, constants));
  }

  // Extract default from constraints if present (kwarg default= takes precedence)
  if ('default' in constraints) {
    defaultValue = constraints.default;
    delete constraints.default;
  }
  if ('default_factory' in constraints) {
    defaultValue = constraints.default_factory;
    delete constraints.default_factory;
  }

  return { constraints, defaultValue, isRequired };
}

function parseFieldKwargs(kwargsStr, constants) {
  const constraints = {};
  // Match key=value pairs, handling nested parens in values
  const re = /(\w+)\s*=\s*([^,)]+(?:\([^)]*\))?)/g;
  let m;
  while ((m = re.exec(kwargsStr)) !== null) {
    const key = m[1];
    let value = m[2].trim();
    // Map Python constraint names to IR constraint names
    const keyMap = {
      min_length: 'minLength',
      max_length: 'maxLength',
      ge: 'min',
      gt: 'gt',
      le: 'max',
      lt: 'lt',
      default: 'default',
      default_factory: 'default_factory',
    };
    const irKey = keyMap[key] || key;
    constraints[irKey] = resolvePyConstant(value, constants);

    // gt=0 is equivalent to positive for numbers
    if (key === 'gt' && constraints[irKey] === 0) {
      constraints.positive = true;
    }
  }
  return constraints;
}

/**
 * Extract module-level constants from Python source.
 */
function extractPythonConstants(source) {
  const constants = {
    // Hardcoded fallbacks for constants imported from other modules
    SCHEMA_VERSION: 1,
  };
  const re = /^(\w+)\s*=\s*(.+)$/gm;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    if (name === name.toUpperCase()) {
      // Only capture UPPERCASE constants (file-level overrides take precedence)
      const value = m[2].trim();
      constants[name] = resolvePyConstant(value, constants);
    }
  }
  return constants;
}

/**
 * Extract all Pydantic model classes and their fields from Python source.
 */
function parsePythonSchema(source) {
  const constants = extractPythonConstants(source);
  const models = {};

  // str-Enum subclasses (e.g. `class SourceRole(str, Enum)`) serialize as
  // plain strings — treat them as string fields, not nested models.
  const strEnums = new Set();
  const enumRe = /^class (\w+)\(\s*str\s*,\s*Enum\s*\):/gm;
  let enumMatch;
  while ((enumMatch = enumRe.exec(source)) !== null) {
    strEnums.add(enumMatch[1]);
  }

  // Find all class Xxx(BaseModel): blocks
  const classRe = /^class (\w+)\(BaseModel\):/gm;
  let classMatch;
  while ((classMatch = classRe.exec(source)) !== null) {
    const className = classMatch[1];
    const classStart = classMatch.index;
    // Get the class body: find the next line that starts at column 0
    const afterClass = source.indexOf('\n', classStart);
    let bodyStart = afterClass + 1;
    // Class body lines are indented by 4 spaces
    const lines = source.slice(bodyStart).split('\n');
    let endLine = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // End of class body: non-empty line with 0-3 spaces indent (not inside class)
      if (
        line.trim() !== '' &&
        line.length > 0 &&
        !line.startsWith('    ') &&
        !line.startsWith('\t')
      ) {
        endLine = i;
        break;
      }
    }
    const body = lines.slice(0, endLine).join('\n');

    // Parse fields: lines with 4-space indent and type annotation
    const fields = [];
    const fieldRe =
      /^ {4}(\w+)\s*:\s*(.+?)(?:\s*=\s*Field\(([^)]*(?:\([^)]*\)[^)]*)*)\))?(?:\s*=\s*(.+))?$/gm;
    let fm;
    while ((fm = fieldRe.exec(body)) !== null) {
      const name = fm[1];
      if (name.startsWith('_') || SKIP_PY_FIELDS.has(name)) continue;

      const typeAnnot = fm[2].trim();
      const fieldArgs = fm[3] ? fm[3].trim() : '';
      const simpleDefault = fm[4] ? fm[4].trim() : undefined;

      // If the line has a # comment in the type annotation, strip it
      const commentIdx = typeAnnot.indexOf('#');
      const cleanType = commentIdx >= 0 ? typeAnnot.slice(0, commentIdx).trim() : typeAnnot;

      const { type, optional, unionTypes, nestedModel, itemType, itemNestedModel, isInteger } =
        parsePythonType(cleanType);

      // Map str-Enum references to plain strings
      let fType = type;
      let fNestedModel = nestedModel;
      const enumBase = cleanType
        .replace(/^Optional\[(.+)\]$/, '$1')
        .replace(/^List\[(.+)\]$/, '$1')
        .trim();
      if (strEnums.has(enumBase)) {
        fType = 'string';
        fNestedModel = null;
      }
      const { constraints, defaultValue, isRequired } = parseFieldArgs(fieldArgs, constants);

      // Determine optionality
      let isOptional = optional;
      // If it has a default value or default_factory, it's optional in practice
      if (defaultValue !== undefined && !isRequired) {
        isOptional = true;
      }
      // Field with ... (Ellipsis) = required
      if (isRequired) {
        isOptional = false;
      }

      // Use simple default if no Field() default
      let finalDefault = defaultValue;
      if (finalDefault === undefined && simpleDefault !== undefined) {
        finalDefault = resolvePyConstant(simpleDefault, constants);
        if (!isRequired) isOptional = true;
      }

      // Handle number type: Python int → integer constraint
      if (isInteger) {
        constraints.integer = true;
      }

      fields.push({
        name,
        type: fType,
        optional: isOptional,
        default: finalDefault,
        constraints,
        unionTypes,
        nestedModel: fNestedModel,
        itemType,
        itemNestedModel,
      });
    }

    if (fields.length > 0) {
      models[className] = { fields };
    }
  }

  return { version: 1, source: 'python', models };
}

// ---------------------------------------------------------------------------
// TypeScript / Zod schema parser
// ---------------------------------------------------------------------------

/**
 * Map a Zod base method to an IR type.
 */
function zodBaseType(method) {
  const m = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'date',
    url: 'url',
  };
  return m[method] || 'string';
}

/**
 * Extract the content of the outer-most z.object({...}) or .object({...}).
 * Returns { content: string, startOffset: number } where content is the text
 * between the outer { and matching }.
 */
function extractObjectBody(source, startPattern) {
  const idx = source.indexOf(startPattern);
  if (idx === -1) return null;

  const openIdx = source.indexOf('{', idx);
  if (openIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: source.slice(openIdx + 1, i),
          fullExpression: source.slice(idx, i + 1),
        };
      }
    }
  }
  return null;
}

/**
 * Split Zod object body into individual field expressions.
 * Walks character by character tracking depth; splits on commas at depth 0.
 */
function splitZodFields(body) {
  const fields = [];
  let depth = 0; // brace depth
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let stringChar = '';
  let currentStart = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === '(') parenDepth++;
    if (ch === ')') parenDepth--;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;

    if (ch === ',' && depth === 0 && parenDepth === 0 && bracketDepth === 0) {
      const expr = body.slice(currentStart, i).trim();
      if (expr) fields.push(expr);
      currentStart = i + 1;
    }
  }
  // Last field
  const last = body.slice(currentStart).trim();
  if (last) fields.push(last);

  return fields;
}

/**
 * Parse a single Zod field expression.
 * Returns a FieldIR or null if it doesn't match a field pattern.
 */
function parseZodField(expr) {
  // Match: fieldName: z.baseType().chain()...
  const nameMatch = expr.match(/^(\w+)\s*:\s*(.+)$/s);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const value = nameMatch[2].trim();

  return parseZodChain(name, value);
}

/**
 * Normalize a Zod chain: collapse newlines and multiple spaces so that
 * patterns like "z\n        .object({" become "z.object({".
 */
function normalizeZodChain(chain) {
  // Collapse all whitespace to single space, then remove spaces around dots
  // so "z\n  .object({" becomes "z.object({"
  return chain
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*/g, '.')
    .trim();
}

/**
 * Parse a Zod chain expression into a FieldIR.
 */
function parseZodChain(fieldName, chain) {
  // Normalize whitespace so multi-line chains parse correctly
  chain = normalizeZodChain(chain);
  const result = {
    name: fieldName,
    type: 'string',
    optional: false,
    default: undefined,
    constraints: {},
    unionTypes: null,
    nestedModel: null,
    itemType: null,
    itemNestedModel: null,
    itemConstraints: null,
  };

  // Extract the complete chain, handling multi-line
  // Split into tokens: track depth for method calls
  const methods = splitZodMethods(chain);
  if (methods.length === 0) return result;

  // Process the constructor (first token)
  const first = methods[0];
  const baseMatch = first.match(/^z\.(\w+)\(\)$/);
  const arrayMatch = first.match(/^z\.array\((.+)\)$/s);
  const objectMatch = first.match(/^z\.object\(\{(.+)\}\)$/s);
  const unionMatch = first.match(/^z\.union\(\[(.+)\]\)$/s);

  if (unionMatch) {
    result.type = 'union';
    const branches = splitUnionBranches(unionMatch[1]);
    result.unionTypes = branches.map((b) => {
      const trimmed = b.trim();
      if (trimmed.startsWith('z.string()')) return 'string';
      if (trimmed.startsWith('z.number()')) return 'number';
      if (trimmed.startsWith('z.boolean()')) return 'boolean';
      if (trimmed.startsWith('z.object({')) return 'object';
      if (trimmed.startsWith('z.url()')) return 'url';
      return 'unknown';
    });
    // If one branch is an object, parse its nested model
    const objBranch = branches.find((b) => b.trim().startsWith('z.object({'));
    if (objBranch) {
      result.nestedModel = fieldName; // inline model keyed by field name
    }
  } else if (arrayMatch) {
    result.type = 'array';
    const itemExpr = arrayMatch[1].trim();
    if (itemExpr.startsWith('z.string()')) {
      result.itemType = 'string';
    } else if (itemExpr.startsWith('z.number()')) {
      result.itemType = 'number';
    } else if (itemExpr.startsWith('z.object({')) {
      result.itemType = 'object';
      result.itemNestedModel = fieldName + '_item'; // inline model key
    }
  } else if (objectMatch) {
    result.type = 'object';
    result.nestedModel = fieldName;
  } else if (baseMatch) {
    result.type = zodBaseType(baseMatch[1]);
  } else if (first.startsWith('z.')) {
    // Multi-line expression that starts with z.something — try to match
    if (first.includes('.array(')) {
      result.type = 'array';
      result.itemType = 'object'; // assume complex
      result.itemNestedModel = fieldName + '_item';
    } else if (first.includes('.object({')) {
      result.type = 'object';
      result.nestedModel = fieldName;
    } else if (first.includes('.union([')) {
      result.type = 'union';
      result.unionTypes = ['string', 'object'];
      result.nestedModel = fieldName;
    }
  }

  // Process chained methods
  for (let i = 1; i < methods.length; i++) {
    const m = methods[i].trim();
    if (m === '.optional()') {
      result.optional = true;
    } else if (m.startsWith('.default(')) {
      result.optional = true;
      result.default = parseZodDefault(m);
    } else if (m.startsWith('.min(')) {
      const val = parseInt(m.match(/\.min\((\d+)/)?.[1], 10);
      if (!isNaN(val)) {
        if (result.type === 'array') {
          if (!result.itemConstraints) result.itemConstraints = {};
          result.itemConstraints.minLength = val;
        } else {
          if (result.type === 'number') result.constraints.min = val;
          else result.constraints.minLength = val;
        }
      }
    } else if (m.startsWith('.max(')) {
      const val = parseInt(m.match(/\.max\((\d+)/)?.[1], 10);
      if (!isNaN(val)) {
        if (result.type === 'array') {
          if (!result.itemConstraints) result.itemConstraints = {};
          result.itemConstraints.maxLength = val;
        } else {
          if (result.type === 'number') result.constraints.max = val;
          else result.constraints.maxLength = val;
        }
      }
    } else if (m === '.int()') {
      result.constraints.integer = true;
    } else if (m === '.positive()') {
      result.constraints.positive = true;
    } else if (m === '.url()') {
      result.type = 'url';
    }
  }

  return result;
}

/**
 * Split a Zod chain into individual method calls.
 * e.g., "z.string().min(5).optional()" → ["z.string()", ".min(5)", ".optional()"]
 */
function splitZodMethods(chain) {
  const methods = [];
  let i;

  // Find the initial z.X() call
  let depth = 0;
  let start = 0;
  let inString = false;
  let stringChar = '';

  for (i = 0; i < chain.length; i++) {
    const ch = chain[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;

    // End of first token: when we hit ')' at depth 0 and next non-space char is '.' or end
    if (depth === 0 && ch === ')') {
      methods.push(chain.slice(start, i + 1));
      // Skip whitespace to check if another method follows
      let next = i + 1;
      while (next < chain.length && chain[next] === ' ') next++;
      if (next < chain.length && chain[next] === '.') {
        start = next;
        i = next - 1; // loop will increment to 'next'
      } else {
        break;
      }
    }
  }

  return methods;
}

function splitUnionBranches(unionContent) {
  const branches = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < unionContent.length; i++) {
    const ch = unionContent[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      branches.push(unionContent.slice(start, i));
      start = i + 1;
    }
  }
  branches.push(unionContent.slice(start));
  return branches;
}

function parseZodDefault(methodStr) {
  const match = methodStr.match(/^\.default\((.+)\)$/s);
  if (!match) return undefined;
  const val = match[1].trim();
  if (val === 'false') return false;
  if (val === 'true') return true;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (val === '[]') return [];
  if (val === '{}') return {};
  // String literal
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }
  return val;
}

// ---------------------------------------------------------------------------
// TypeScript schema module resolution
//
// The structural z.object can live inline in content.config.ts (fixtures) or
// in a separate module imported by it (src/schemas/post.ts). Resolution is
// textual on purpose: this gate stays line-based and does not execute Zod.
// ---------------------------------------------------------------------------

const TS_MODULE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLocalModuleSpecifier(spec) {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('~/');
}

function resolveModulePath(spec, fromFile) {
  const fromDir = dirname(resolve(fromFile));
  const base = spec.startsWith('~/') ? resolve(fromDir, spec.slice(2)) : resolve(fromDir, spec);
  const candidates = [
    base,
    ...TS_MODULE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...TS_MODULE_EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || null
  );
}

function findSchemaIdentifier(source) {
  const match = source.match(/\bschema\s*:\s*([A-Za-z_$][\w$]*)/);
  return match ? match[1] : null;
}

function findDeclarationStart(source, identifier) {
  const re = new RegExp(
    `\\b(?:export\\s+)?(?:const|let|var)\\s+${escapeRegExp(identifier)}\\s*[:=]`
  );
  const match = re.exec(source);
  return match ? match.index : -1;
}

/**
 * Collect import/re-export bindings from a module. Only the local name and the
 * module specifier matter; the parser follows named, default, and re-exported
 * identifiers so a schema can be re-exported from content.config.ts.
 */
function parseModuleBindings(source) {
  const bindings = [];
  let match;

  const namedRe = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namedRe.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      if (!cleaned) continue;
      const [imported, local] = cleaned.split(/\s+as\s+/).map((s) => s.trim());
      bindings.push({ local: local || imported, spec: match[2] });
    }
  }

  const defaultRe = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultRe.exec(source)) !== null) {
    bindings.push({ local: match[1], spec: match[2] });
  }

  // `export { x } from './mod'` / `export { x as y } from './mod'`
  const reexportRe = /\bexport\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reexportRe.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      if (!cleaned) continue;
      const [imported, local] = cleaned.split(/\s+as\s+/).map((s) => s.trim());
      bindings.push({ local: local || imported, spec: match[2] });
    }
  }

  return bindings;
}

function findLocalBinding(source, identifier) {
  return parseModuleBindings(source).find(
    (binding) => binding.local === identifier && isLocalModuleSpecifier(binding.spec)
  );
}

/**
 * Locate the source that defines the posts schema. Returns the config source
 * (for Astro refinements and cross-field markers) plus the defining module
 * source and the declaration offset used for object extraction.
 */
function loadTypeScriptSchema(configPath) {
  const resolvedConfigPath = resolve(configPath);
  const configSource = readFileSync(resolvedConfigPath, 'utf-8');

  // Fast path: inline `schema: z...` (test fixtures and legacy configs).
  if (configSource.includes('schema: z')) {
    return {
      configSource,
      schemaSource: configSource,
      schemaPath: resolvedConfigPath,
      schemaStart: configSource.indexOf('schema: z'),
    };
  }

  const identifier = findSchemaIdentifier(configSource);
  if (!identifier) {
    throw new Error(
      'Could not find "schema: z" or "schema: <identifier>" in the TypeScript config'
    );
  }

  const configDeclaration = findDeclarationStart(configSource, identifier);
  if (configDeclaration !== -1) {
    return {
      configSource,
      schemaSource: configSource,
      schemaPath: resolvedConfigPath,
      schemaStart: configDeclaration,
    };
  }

  let currentPath = resolvedConfigPath;
  let currentSource = configSource;
  const visited = new Set([resolvedConfigPath]);

  for (let depth = 0; depth < 5; depth++) {
    const binding = findLocalBinding(currentSource, identifier);
    let nextPath;

    if (binding) {
      nextPath = resolveModulePath(binding.spec, currentPath);
      if (!nextPath) {
        throw new Error(`Cannot resolve module "${binding.spec}" imported from ${currentPath}`);
      }
    } else {
      // Follow `export * from './module'` if present.
      const star = currentSource.match(/\bexport\s+\*\s+from\s+['"]([^'"]+)['"]/);
      if (!star) break;
      nextPath = resolveModulePath(star[1], currentPath);
      if (!nextPath) {
        throw new Error(`Cannot resolve module "${star[1]}" re-exported from ${currentPath}`);
      }
    }

    if (visited.has(nextPath)) {
      throw new Error(`Circular schema module import involving ${nextPath}`);
    }
    visited.add(nextPath);

    const nextSource = readFileSync(nextPath, 'utf-8');
    const declaration = findDeclarationStart(nextSource, identifier);
    if (declaration !== -1) {
      return {
        configSource,
        schemaSource: nextSource,
        schemaPath: nextPath,
        schemaStart: declaration,
      };
    }

    currentPath = nextPath;
    currentSource = nextSource;
  }

  throw new Error(`Could not resolve the structural schema "${identifier}" from ${configPath}`);
}

/**
 * Combine the config and schema-module sources for marker checks. Cross-field
 * refinements stay in the config while structural markers (e.g. social's
 * `publish: z.boolean()`) move with the object, so both are evidence.
 */
function combineTypeScriptSources(loaded) {
  if (loaded.configSource === loaded.schemaSource) return loaded.configSource;
  return `${loaded.configSource}\n${loaded.schemaSource}`;
}

/**
 * Parse the TypeScript config.ts file into a SchemaIR.
 */
function parseTypeScriptSchema(source, schemaStart = null) {
  // Find the schema: z.object({...}) block
  // It's in the form: schema: z\n    .object({\n      field: ...,\n    })\n    .superRefine(...)
  // First find "schema: z", or the resolved module declaration.
  const schemaIdx = Number.isInteger(schemaStart) ? schemaStart : source.indexOf('schema: z');
  if (schemaIdx === -1) {
    throw new Error('Could not find "schema: z" in config.ts');
  }

  // Find .object({ or z.object({
  const objResult =
    extractObjectBody(source.slice(schemaIdx), '.object({') ||
    extractObjectBody(source.slice(schemaIdx), 'z.object({');

  if (!objResult) {
    throw new Error('Could not find .object({ or z.object({ after "schema: z"');
  }

  const fields = splitZodFields(objResult.content);
  const parsedFields = [];
  const nestedModels = {};

  for (const expr of fields) {
    const field = parseZodField(expr);
    if (!field) continue;

    parsedFields.push(field);

    // Extract nested model from inline z.object({...})
    // Normalize the expression first so multi-line z\n.object({ becomes z.object({
    if (field.nestedModel) {
      const normalizedExpr = normalizeZodChain(expr);
      const objMatch = normalizedExpr.match(/z\.object\(\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\)/s);
      if (objMatch) {
        const nestedFields = splitZodFields(objMatch[1]);
        const parsedNested = [];
        for (const nf of nestedFields) {
          const pf = parseZodField(nf);
          if (pf) parsedNested.push(pf);
        }
        if (parsedNested.length > 0) {
          nestedModels[field.nestedModel] = { fields: parsedNested };
        }
      }
    }

    // Extract nested model from z.array(z.object({...}))
    if (field.itemNestedModel) {
      const normalizedExpr = normalizeZodChain(expr);
      const arrMatch = normalizedExpr.match(
        /z\.array\(\s*z\.object\(\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\)/s
      );
      if (arrMatch) {
        const nestedFields = splitZodFields(arrMatch[1]);
        const parsedNested = [];
        for (const nf of nestedFields) {
          const pf = parseZodField(nf);
          if (pf) parsedNested.push(pf);
        }
        if (parsedNested.length > 0) {
          nestedModels[field.itemNestedModel] = { fields: parsedNested };
        }
      }
    }
  }

  return {
    version: 1,
    source: 'typescript',
    models: {
      AstroPost: { fields: parsedFields },
      ...nestedModels,
    },
  };
}

// ---------------------------------------------------------------------------
// Schema comparison
// ---------------------------------------------------------------------------

/**
 * Compare two field values for equality (JSON-compatible values, including undefined).
 */
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]));
  }
  // [] and undefined are equivalent for default arrays
  if (Array.isArray(a) && a.length === 0 && b === undefined) return true;
  if (Array.isArray(b) && b.length === 0 && a === undefined) return true;
  return false;
}

/**
 * Compare two fields (top-level or nested). Returns array of diff strings.
 */
function compareFields(pyField, tsField, modelPath, severity) {
  const diffs = [];
  const path = `${modelPath}.${pyField.name}`;

  // Type comparison
  if (pyField.type !== tsField.type) {
    const pyDesc = pyField.type + (pyField.unionTypes ? `<${pyField.unionTypes.join('|')}>` : '');
    const tsDesc = tsField.type + (tsField.unionTypes ? `<${tsField.unionTypes.join('|')}>` : '');
    diffs.push({
      severity: severity,
      category: 'type_mismatch',
      path,
      python: pyDesc,
      typescript: tsDesc,
      message: `Type mismatch: Python "${pyDesc}" vs TypeScript "${tsDesc}"`,
    });
  }

  // Optionality comparison
  if (pyField.optional !== tsField.optional) {
    diffs.push({
      severity: severity,
      category: 'optionality_mismatch',
      path,
      python: pyField.optional ? 'optional' : 'required',
      typescript: tsField.optional ? 'optional' : 'required',
      message: `Optionality mismatch: Python ${pyField.optional ? 'optional' : 'required'} vs TypeScript ${tsField.optional ? 'optional' : 'required'}`,
    });
  }

  // Default comparison
  if (!valuesEqual(pyField.default, tsField.default)) {
    diffs.push({
      severity: severity,
      category: 'default_mismatch',
      path,
      python: JSON.stringify(pyField.default),
      typescript: JSON.stringify(tsField.default),
      message: `Default value mismatch: Python ${JSON.stringify(pyField.default)} vs TypeScript ${JSON.stringify(tsField.default)}`,
    });
  }

  // Constraint comparison for strings
  if (pyField.type === 'string' && tsField.type === 'string') {
    const pyMin = pyField.constraints.minLength;
    const tsMin = tsField.constraints.minLength;
    if (pyMin !== undefined && tsMin !== undefined && pyMin !== tsMin) {
      diffs.push({
        severity: severity,
        category: 'constraint_mismatch',
        path: `${path}.minLength`,
        python: pyMin,
        typescript: tsMin,
        message: `minLength mismatch: Python ${pyMin} vs TypeScript ${tsMin}`,
      });
    }
    const pyMax = pyField.constraints.maxLength;
    const tsMax = tsField.constraints.maxLength;
    if (pyMax !== undefined && tsMax !== undefined && pyMax !== tsMax) {
      diffs.push({
        severity: severity,
        category: 'constraint_mismatch',
        path: `${path}.maxLength`,
        python: pyMax,
        typescript: tsMax,
        message: `maxLength mismatch: Python ${pyMax} vs TypeScript ${tsMax}`,
      });
    }
  }

  // Constraint comparison for numbers
  if (pyField.type === 'number' && tsField.type === 'number') {
    if (pyField.constraints.integer !== tsField.constraints.integer) {
      diffs.push({
        severity: severity,
        category: 'constraint_mismatch',
        path: `${path}.integer`,
        python: pyField.constraints.integer ? 'yes' : 'no',
        typescript: tsField.constraints.integer ? 'yes' : 'no',
        message: `Integer constraint mismatch: Python ${pyField.constraints.integer ? 'int' : 'float'} vs TypeScript ${tsField.constraints.integer ? 'int' : 'float'}`,
      });
    }
  }

  // Array item type comparison
  if (pyField.type === 'array' && tsField.type === 'array') {
    if (pyField.itemType !== tsField.itemType) {
      diffs.push({
        severity: severity,
        category: 'type_mismatch',
        path: `${path}[]`,
        python: pyField.itemType,
        typescript: tsField.itemType,
        message: `Array item type mismatch: Python "${pyField.itemType}" vs TypeScript "${tsField.itemType}"`,
      });
    }
  }

  return diffs;
}

/**
 * Compare two sets of fields. Returns array of diffs.
 */
function compareFieldSets(pyFields, tsFields, modelPath, nestedPy, nestedTs, severity) {
  const diffs = [];
  const pyMap = new Map(pyFields.map((f) => [f.name, f]));
  const tsMap = new Map(tsFields.map((f) => [f.name, f]));

  // Check fields present in Python but missing in TypeScript
  for (const name of pyMap.keys()) {
    if (!tsMap.has(name)) {
      diffs.push({
        severity: 'error',
        category: 'field_missing',
        path: `${modelPath}.${name}`,
        message: `Field "${name}" exists in Python AstroPost but NOT in TypeScript config.ts`,
      });
    }
  }

  // Check fields present in TypeScript but missing in Python
  for (const name of tsMap.keys()) {
    if (!pyMap.has(name)) {
      diffs.push({
        severity: 'error',
        category: 'field_missing',
        path: `${modelPath}.${name}`,
        message: `Field "${name}" exists in TypeScript config.ts but NOT in Python AstroPost`,
      });
    }
  }

  // Compare common fields
  for (const name of pyMap.keys()) {
    if (!tsMap.has(name)) continue;
    const pyField = pyMap.get(name);
    const tsField = tsMap.get(name);

    diffs.push(...compareFields(pyField, tsField, modelPath, severity));

    // Compare nested object models
    if (pyField.nestedModel && tsField.nestedModel) {
      const pyNested = nestedPy[pyField.nestedModel];
      const tsNested = nestedTs[tsField.nestedModel];
      if (pyNested && tsNested) {
        diffs.push(
          ...compareFieldSets(
            pyNested.fields,
            tsNested.fields,
            `${modelPath}.${name}`,
            nestedPy,
            nestedTs,
            severity
          )
        );
      }
    }

    // Compare nested array<object> models
    if (pyField.itemNestedModel && tsField.itemNestedModel) {
      const pyNested = nestedPy[pyField.itemNestedModel];
      const tsNested = nestedTs[tsField.itemNestedModel];
      if (pyNested && tsNested) {
        diffs.push(
          ...compareFieldSets(
            pyNested.fields,
            tsNested.fields,
            `${modelPath}.${name}[]`,
            nestedPy,
            nestedTs,
            severity
          )
        );
      }
    }
  }

  return diffs;
}

/**
 * Check cross-field rule invariants against the raw sources.
 * Returns an array of diffs (category 'cross_field_invariant', always error —
 * never allowlisted). pySource may be null when running on a snapshot
 * fallback; then only the TypeScript side is checked.
 *
 * The check is scoped to the AstroPost content contract: fixture schemas
 * used by the gate's own tests carry no superRefine/model_validator rules,
 * so when neither source shows one the check is skipped (with an info line)
 * instead of failing every fixture comparison.
 */
function checkCrossFieldInvariants(pySourceOrNull, tsSource) {
  const diffs = [];
  const looksLikeContentContract =
    tsSource.includes('.superRefine(') ||
    (pySourceOrNull !== null &&
      pySourceOrNull !== undefined &&
      pySourceOrNull.includes('model_validator'));
  if (!looksLikeContentContract) {
    console.log(
      '[contract-sync] Skipping cross-field invariant checks (not the AstroPost content contract).'
    );
    return diffs;
  }

  if (pySourceOrNull === null || pySourceOrNull === undefined) {
    console.log(
      '[contract-sync] Backend source unavailable (snapshot fallback) — backend-side rule mirrors unverifiable; checking TypeScript side only.'
    );
  }

  for (const inv of CROSS_FIELD_INVARIANTS) {
    if (pySourceOrNull !== null && pySourceOrNull !== undefined) {
      for (const marker of inv.pythonMarkers) {
        if (!pySourceOrNull.includes(marker)) {
          diffs.push({
            severity: 'error',
            category: 'cross_field_invariant',
            path: `cross-field.${inv.id}`,
            message: `[cross-field invariant ${inv.id}] ${inv.title} — backend mirror missing: frontend_schema.py does not contain "${marker}"`,
          });
        }
      }
    }
    for (const marker of inv.tsMarkers) {
      if (!tsSource.includes(marker)) {
        diffs.push({
          severity: 'error',
          category: 'cross_field_invariant',
          path: `cross-field.${inv.id}`,
          message: `[cross-field invariant ${inv.id}] ${inv.title} — frontend mirror missing: the config/schema sources do not contain "${marker}"`,
        });
      }
    }
  }

  if (diffs.length === 0) {
    console.log(
      `[contract-sync] cross-field invariants verified (${CROSS_FIELD_INVARIANTS.length}/${CROSS_FIELD_INVARIANTS.length}): ${CROSS_FIELD_INVARIANTS.map((i) => i.id).join(', ')}.`
    );
  }
  return diffs;
}

/**
 * Main comparison function.
 */
function compareSchemas(pyIr, tsIr, strictMode = false) {
  const pyAstro = pyIr.models['AstroPost'];
  const tsAstro = tsIr.models['AstroPost'];

  if (!pyAstro) {
    return [
      {
        severity: 'error',
        category: 'parse_error',
        path: '',
        message: 'No AstroPost model found in Python schema',
      },
    ];
  }
  if (!tsAstro) {
    return [
      {
        severity: 'error',
        category: 'parse_error',
        path: '',
        message: 'No AstroPost fields found in TypeScript schema',
      },
    ];
  }

  // Compare top-level fields.
  // V1: type/constraint/nested mismatches are warnings.
  // Strict mode: all mismatches are errors (except those in ALLOWED_DIVERGENCES).
  const typeConstraintSeverity = strictMode ? 'error' : 'warning';
  const diffs = compareFieldSets(
    pyAstro.fields,
    tsAstro.fields,
    'AstroPost',
    pyIr.models,
    tsIr.models,
    typeConstraintSeverity
  );

  // Known intentional divergences are tolerated unconditionally, including in
  // strict mode (see ALLOWED_DIVERGENCES). Downgrade them so they can never
  // fail the build, even when strict mode escalated their severity to error.
  return diffs.map((d) =>
    d.severity === 'error' && isAllowedDivergence(d.path, d.category)
      ? { ...d, severity: 'warning' }
      : d
  );
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function printReport(diffs, strictMode = false) {
  const errors = diffs.filter((d) => d.severity === 'error');
  const warnings = diffs.filter((d) => d.severity === 'warning');
  const allowedWarnings = [];
  const realWarnings = [];

  for (const w of warnings) {
    if (isAllowedDivergence(w.path, w.category)) {
      allowedWarnings.push(w);
    } else {
      realWarnings.push(w);
    }
  }

  if (errors.length === 0 && realWarnings.length === 0) {
    console.log(`[contract-sync] OK — full parity confirmed.`);
    if (allowedWarnings.length > 0) {
      console.log(`[contract-sync] ${allowedWarnings.length} known divergence(s) tolerated:`);
      for (const w of allowedWarnings) {
        console.log(
          `  • ${w.path}: ${w.message} (allowed: ${ALLOWED_DIVERGENCES.find((d) => d.path === w.path)?.reason})`
        );
      }
    }
    return 0;
  }

  if (errors.length > 0) {
    console.error(`\n[contract-sync] ${errors.length} PARITY ERROR(S):`);
    for (const e of errors) {
      console.error(`  ❌ ${e.path}: ${e.message}`);
    }
  }

  if (realWarnings.length > 0) {
    if (strictMode) {
      console.error(
        `\n[contract-sync] ${realWarnings.length} STRICT-MODE ERROR(S) (type/constraint — escalated from warning):`
      );
      for (const w of realWarnings) {
        console.error(`  ❌ ${w.path}: ${w.message}`);
        if (w.python) console.error(`     Python:   ${w.python}`);
        if (w.typescript) console.error(`     TypeScript: ${w.typescript}`);
      }
    } else {
      console.warn(
        `\n[contract-sync] ${realWarnings.length} WARNING(S) (type/constraint — informational in V1):`
      );
      for (const w of realWarnings) {
        console.warn(`  ⚠️  ${w.path}: ${w.message}`);
        if (w.python) console.warn(`     Python:   ${w.python}`);
        if (w.typescript) console.warn(`     TypeScript: ${w.typescript}`);
      }
    }
  }

  if (allowedWarnings.length > 0) {
    console.warn(`\n[contract-sync] ${allowedWarnings.length} known divergence(s) tolerated:`);
    for (const w of allowedWarnings) {
      console.warn(`  ✓ ${w.path}: ${w.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      '\n[contract-sync] PARITY FAILURE. See docs/adr/0003-content-schema-contract.md for the coordinated change protocol.'
    );
    return 1;
  }

  if (strictMode && realWarnings.length > 0) {
    console.error(
      '\n[contract-sync] STRICT MODE FAILURE. New divergences detected — fix or add to ALLOWED_DIVERGENCES with documented reason.'
    );
    return 1;
  }

  console.warn('\n[contract-sync] Warnings only — parity check passed (V1).');
  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let pyIr, tsIr;
  let pySourceForInvariants = null;

  if (printFields) {
    let loaded;
    try {
      loaded = loadTypeScriptSchema(tsPath);
    } catch (e) {
      console.error(`Cannot read TypeScript schema: ${tsPath}\n${e.message}`);
      process.exit(2);
    }

    try {
      const ir = parseTypeScriptSchema(loaded.schemaSource, loaded.schemaStart);
      const fields = ir.models['AstroPost']?.fields ?? [];
      if (fields.length === 0) {
        console.error('No fields extracted from the TypeScript schema.');
        process.exit(2);
      }
      console.log(fields.map((field) => field.name).join('\n'));
      process.exit(0);
    } catch (e) {
      console.error(`Failed to parse TypeScript schema: ${e.message}`);
      process.exit(2);
    }
  }

  if (mode === 'generate-snapshot') {
    // Generate snapshot from Python schema
    let pySource;
    try {
      pySource = readFileSync(resolve(pyPath), 'utf-8');
    } catch (e) {
      console.error(`Cannot read Python schema: ${pyPath}\n${e.message}`);
      process.exit(2);
    }

    try {
      pyIr = parsePythonSchema(pySource);
    } catch (e) {
      console.error(`Failed to parse Python schema: ${e.message}`);
      process.exit(2);
    }

    if (!pyIr.models['AstroPost'] || pyIr.models['AstroPost'].fields.length === 0) {
      console.error('No fields extracted from AstroPost — check regex or file format.');
      process.exit(2);
    }

    // Also read TS to check consistency
    let tsLoaded;
    try {
      tsLoaded = loadTypeScriptSchema(tsPath);
    } catch (e) {
      console.error(`Cannot read TypeScript schema: ${tsPath}\n${e.message}`);
      process.exit(2);
    }

    try {
      tsIr = parseTypeScriptSchema(tsLoaded.schemaSource, tsLoaded.schemaStart);
    } catch (e) {
      console.error(`Failed to parse TypeScript schema: ${e.message}`);
      process.exit(2);
    }

    const snapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      backendRef: 'main',
      pythonIR: pyIr,
    };

    const outPath = resolve(generatePath);
    // Preserve the existing generatedAt when the extracted IR is unchanged so
    // no-op regenerations (weekly bot runs with no backend drift) produce an
    // empty diff and the workflow's `git diff --cached --quiet` guard skips
    // the commit/PR — otherwise every run opens a timestamp-only PR.
    try {
      const existing = JSON.parse(readFileSync(outPath, 'utf-8'));
      if (existing && JSON.stringify(existing.pythonIR) === JSON.stringify(snapshot.pythonIR)) {
        snapshot.generatedAt = existing.generatedAt;
      }
    } catch {
      // No existing snapshot; keep the fresh timestamp.
    }

    try {
      // Format through Prettier (parser json) so the committed snapshot always
      // passes `npm run format:check` in the Content Guard lint step — the bot
      // workflow and local `sync:contract-snapshot` runs both commit this file.
      const formatted = await format(JSON.stringify(snapshot, null, 2), { parser: 'json' });
      writeFileSync(outPath, formatted);
      console.log(`[contract-sync] Snapshot written to ${outPath}`);
      console.log(
        `[contract-sync] Python fields: ${pyIr.models['AstroPost'].fields.length} top-level, ${Object.keys(pyIr.models).length - 1} nested models`
      );
    } catch (e) {
      console.error(`Cannot write snapshot: ${outPath}\n${e.message}`);
      process.exit(2);
    }

    // Also run comparison to validate the snapshot
    const diffs = compareSchemas(pyIr, tsIr, strictMode);
    diffs.push(...checkCrossFieldInvariants(pySource, combineTypeScriptSources(tsLoaded)));
    const exitCode = printReport(diffs, strictMode);
    process.exit(exitCode);
  }

  // Load Python IR (from live file or snapshot)
  if (mode === 'snapshot') {
    console.log(
      '[contract-sync] Snapshot mode: cross-field invariant checks require live sources — run compare mode for rule assertions.'
    );
    try {
      const snapshotData = JSON.parse(readFileSync(resolve(snapshotPath), 'utf-8'));
      pyIr = snapshotData.pythonIR;
      const age = Date.now() - new Date(snapshotData.generatedAt).getTime();
      const ageDays = Math.round(age / (1000 * 60 * 60 * 24));
      if (ageDays > 7) {
        console.warn(
          `[contract-sync] WARNING: Snapshot is ${ageDays} days old (generated ${snapshotData.generatedAt}). If the backend contract changed since then, update with: npm run sync:contract-snapshot (note: no-op regenerations preserve the timestamp by design).`
        );
      } else {
        console.log(
          `[contract-sync] Using snapshot from ${snapshotData.generatedAt} (${ageDays} day(s) old)`
        );
      }
    } catch (e) {
      console.error(`Cannot read or parse snapshot: ${snapshotPath}\n${e.message}`);
      process.exit(2);
    }
  } else {
    // Load Python schema from live file
    let pySource;
    try {
      pySource = readFileSync(resolve(pyPath), 'utf-8');
    } catch (e) {
      // If the file doesn't exist and a snapshot is available, try snapshot fallback
      const defaultSnapshot = '.contract-snapshots/frontend_schema.snapshot.json';
      try {
        const snapshotData = JSON.parse(readFileSync(resolve(defaultSnapshot), 'utf-8'));
        pyIr = snapshotData.pythonIR;
        console.warn(
          `[contract-sync] Python schema not found at ${pyPath}. Using snapshot fallback.`
        );
      } catch {
        console.error(`Cannot read Python schema: ${pyPath}\n${e.message}`);
        process.exit(2);
      }
      // If fallback succeeded, skip the parse step
      if (!pyIr) {
        console.error(`Cannot read Python schema: ${pyPath}\n${e.message}`);
        process.exit(2);
      }
    }

    if (!pyIr) {
      try {
        pyIr = parsePythonSchema(pySource);
        pySourceForInvariants = pySource;
      } catch (e) {
        console.error(`Failed to parse Python schema: ${e.message}`);
        process.exit(2);
      }
    }
  }

  // Load TypeScript schema (inline or from the imported structural module)
  let tsLoaded;
  try {
    tsLoaded = loadTypeScriptSchema(tsPath);
  } catch (e) {
    console.error(`Cannot read TypeScript schema: ${tsPath}\n${e.message}`);
    process.exit(2);
  }

  try {
    tsIr = parseTypeScriptSchema(tsLoaded.schemaSource, tsLoaded.schemaStart);
  } catch (e) {
    console.error(`Failed to parse TypeScript schema: ${e.message}`);
    process.exit(2);
  }

  // Validate field extraction
  if (!pyIr.models['AstroPost'] || pyIr.models['AstroPost'].fields.length === 0) {
    console.error('No fields extracted from AstroPost — check regex or file format.');
    process.exit(2);
  }
  if (!tsIr.models['AstroPost'] || tsIr.models['AstroPost'].fields.length === 0) {
    console.error('No fields extracted from config.ts — check regex or file format.');
    process.exit(2);
  }

  // Compare
  const diffs = compareSchemas(pyIr, tsIr, strictMode);
  if (mode !== 'snapshot') {
    diffs.push(
      ...checkCrossFieldInvariants(pySourceForInvariants, combineTypeScriptSources(tsLoaded))
    );
  }
  const exitCode = printReport(diffs, strictMode);
  process.exit(exitCode);
}

await main();
