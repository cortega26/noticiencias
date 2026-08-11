/**
 * Minimal gray-matter-compatible frontmatter parser backed by js-yaml 4.
 *
 * Replaces the `gray-matter` dependency (which pins unmaintained js-yaml 3.x,
 * vulnerable to CVE-2026-59870 with no backport). Split/parse semantics match
 * gray-matter 4.0.3 exactly (verified on the production post corpus); the only
 * serialization difference is quote style — js-yaml 4 leaves scalars plain
 * where js-yaml 3 single-quoted strings containing ':' or ',' — which is
 * YAML-semantically identical and idempotent (see tests/frontmatter-parser.test.ts).
 *
 * Supported API surface (all call sites in scripts/):
 *   - matter(str)                    -> { data, content, excerpt, orig }
 *   - stringify(contentOrFile, data) -> re-serialized markdown
 */

import { load, dump } from 'js-yaml';

const DELIMITER = '---';

function stripBom(str) {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

function newline(str) {
  return str.slice(-1) !== '\n' ? str + '\n' : str;
}

export function matter(input) {
  if (input === '') {
    return { data: {}, content: input, excerpt: '', orig: input };
  }

  const str = stripBom(String(input));
  const file = { data: {}, content: str, excerpt: '', orig: str };

  // Not frontmatter: does not start with the opening delimiter.
  if (!str.startsWith(DELIMITER)) {
    return file;
  }
  // A fourth hyphen (e.g. "----") means the delimiter is not a frontmatter marker.
  if (str.charAt(DELIMITER.length) === DELIMITER.slice(-1)) {
    return file;
  }

  let body = str.slice(DELIMITER.length);
  const len = body.length;
  const close = `\n${DELIMITER}`;

  let closeIndex = body.indexOf(close);
  if (closeIndex === -1) {
    closeIndex = len;
  }

  const matterBlock = body.slice(0, closeIndex);
  const commentStripped = matterBlock.replace(/^\s*#[^\n]+/gm, '').trim();

  if (commentStripped === '') {
    file.data = {};
  } else {
    // js-yaml 4 `load` uses the default (safe) schema, matching js-yaml 3
    // `safeLoad` used by gray-matter; invalid YAML throws YAMLException.
    file.data = load(matterBlock) || {};
  }

  if (closeIndex === len) {
    // No closing delimiter: the whole remainder was frontmatter.
    file.content = '';
  } else {
    file.content = body.slice(closeIndex + close.length);
    if (file.content[0] === '\r') {
      file.content = file.content.slice(1);
    }
    if (file.content[0] === '\n') {
      file.content = file.content.slice(1);
    }
  }

  return file;
}

export function stringify(file, data) {
  if (data == null && typeof file === 'string') {
    return newline(file);
  }

  const str = typeof file === 'string' ? file : file.content;
  const baseData = typeof file === 'string' ? {} : file.data || {};
  const merged = Object.assign({}, baseData, data);
  const dumped = dump(merged).trim();

  let buf = '';
  if (dumped !== '{}') {
    buf = `${DELIMITER}\n${dumped}\n${DELIMITER}\n`;
  }
  return buf + newline(str);
}

export default matter;
