/**
 * Hygiene gate: fails when tracked PID/socket/log/database/cache/build artifacts
 * appear outside approved fixture paths.
 *
 * Approved fixture directories (negation patterns) are applied BEFORE the
 * positive artifact checks so a fixture inside `tests/fixtures` is never
 * flagged.
 */

import { execSync } from 'node:child_process';

const APPROVED_FIXTURES = ['tests/fixtures/'];

const ARTIFACT_PATTERNS = [
  { pattern: /(^|\/)daemon\.pid$/, label: 'CodeGraph daemon PID' },
  { pattern: /(^|\/)daemon\..+\.sock$/, label: 'CodeGraph daemon socket' },
  { pattern: /(^|\/)data\/logs\//, label: 'log file under data/logs/' },
  { pattern: /(^|\/).*\.db$/, label: 'SQLite/DB runtime file' },
  { pattern: /(^|\/).*\.db-(wal|shm)$/, label: 'SQLite WAL/SHM file' },
  { pattern: /(^|\/)\.cache\//, label: '.cache directory' },
];

function listTrackedFiles() {
  const output = execSync(
    'git ls-files --cached --full-name',
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  return output.trim().split('\n').filter(Boolean);
}

function isApprovedFixture(file) {
  return APPROVED_FIXTURES.some((fixture) => file.startsWith(fixture));
}

function main() {
  const files = listTrackedFiles();
  const violations = [];

  for (const file of files) {
    if (isApprovedFixture(file)) continue;

    for (const { pattern, label } of ARTIFACT_PATTERNS) {
      if (pattern.test(file)) {
        violations.push(`  ${file} (${label})`);
        break; // report once per file
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n[check-runtime-artifacts] FAIL — ${violations.length} tracked runtime artifact(s):\n`,
    );
    for (const v of violations) {
      console.error(v);
    }
    console.error(
      '\nRemove them from tracking and add ignore rules to .gitignore.\n',
    );
    process.exit(1);
  }

  console.log('[check-runtime-artifacts] OK — no tracked runtime artifacts.');
}

main();
