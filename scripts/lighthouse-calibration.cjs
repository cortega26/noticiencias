'use strict';

/**
 * Calibration helpers for the monthly Lighthouse monitor
 * (.github/workflows/perf-monitor.yml).
 *
 * Lighthouse emulates a mid-tier phone by slowing the host CPU down 4x. That
 * only holds on a fast host: on a developer machine (benchmarkIndex ~3000+) the
 * default gives the intended device, while a GitHub runner (benchmarkIndex ~570)
 * is already slow and gets over-throttled, which inflates Total Blocking Time
 * (2.1 s on the runner vs 20-60 ms on the same build locally) and drags the
 * Performance score down for reasons unrelated to the site.
 *
 * So the monitor scales the multiplier to the host, keeps the emulated device
 * constant, and reports the median of several runs. The pass threshold (80) is
 * untouched. CommonJS so the tests and the ESM CLI wrapper can share it.
 */

const DEFAULT_SLOWDOWN = 4;
// benchmarkIndex of the emulated device: the default 4x on a ~3000-index host.
const EMULATED_BENCHMARK_INDEX = 760;

/** CPU slowdown that emulates the reference device on a host of this speed. */
function cpuSlowdownFor(benchmarkIndex) {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) return DEFAULT_SLOWDOWN;
  const scaled = benchmarkIndex / EMULATED_BENCHMARK_INDEX;
  return Math.round(Math.min(DEFAULT_SLOWDOWN, Math.max(1, scaled)) * 100) / 100;
}

/** The report whose Performance score is the median of the given reports. */
function medianReport(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error('medianReport needs at least one Lighthouse report');
  }
  const byPerformance = [...reports].sort(
    (a, b) => a.categories.performance.score - b.categories.performance.score
  );
  return byPerformance[Math.floor((byPerformance.length - 1) / 2)];
}

module.exports = { DEFAULT_SLOWDOWN, EMULATED_BENCHMARK_INDEX, cpuSlowdownFor, medianReport };
