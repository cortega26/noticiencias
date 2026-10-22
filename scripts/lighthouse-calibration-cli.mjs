import { readFileSync } from 'node:fs';
import calibration from './lighthouse-calibration.cjs';

/**
 * CLI used by .github/workflows/perf-monitor.yml:
 *   node scripts/lighthouse-calibration-cli.mjs slowdown <report.json>
 *   node scripts/lighthouse-calibration-cli.mjs median <report.json>...
 */
const [command, ...files] = process.argv.slice(2);
function read(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

if (command === 'slowdown' && files.length === 1) {
  process.stdout.write(
    `${calibration.cpuSlowdownFor(read(files[0]).environment.benchmarkIndex)}\n`
  );
} else if (command === 'median' && files.length > 0) {
  process.stdout.write(JSON.stringify(calibration.medianReport(files.map(read))));
} else {
  process.stderr.write(
    'usage: lighthouse-calibration-cli.mjs slowdown <report> | median <report>...\n'
  );
  process.exitCode = 2;
}
