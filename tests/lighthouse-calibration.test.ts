import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SLOWDOWN,
  EMULATED_BENCHMARK_INDEX,
  cpuSlowdownFor,
  medianReport,
} from '../scripts/lighthouse-calibration.cjs';

const report = (performance: number) => ({ categories: { performance: { score: performance } } });

describe('cpuSlowdownFor', () => {
  it('keeps Lighthouse default 4x on a fast, developer-class host', () => {
    expect(cpuSlowdownFor(3040)).toBe(DEFAULT_SLOWDOWN);
    expect(cpuSlowdownFor(EMULATED_BENCHMARK_INDEX * 4)).toBe(DEFAULT_SLOWDOWN);
  });

  it('never throttles a slow runner below 1x (no speed-up is possible)', () => {
    expect(cpuSlowdownFor(574)).toBe(1);
    expect(cpuSlowdownFor(10)).toBe(1);
  });

  it('scales in between so the emulated device stays constant', () => {
    expect(cpuSlowdownFor(1520)).toBe(2);
  });

  it('falls back to the default when the benchmark is missing or invalid', () => {
    expect(cpuSlowdownFor(undefined as unknown as number)).toBe(DEFAULT_SLOWDOWN);
    expect(cpuSlowdownFor(Number.NaN)).toBe(DEFAULT_SLOWDOWN);
    expect(cpuSlowdownFor(0)).toBe(DEFAULT_SLOWDOWN);
  });
});

describe('medianReport', () => {
  it('picks the run with the median Performance score', () => {
    const median = report(0.8);
    expect(medianReport([report(0.95), median, report(0.6)])).toBe(median);
  });

  it('is stable for an even count (lower median) and a single run', () => {
    const low = report(0.7);
    expect(medianReport([report(0.9), low])).toBe(low);
    const only = report(0.5);
    expect(medianReport([only])).toBe(only);
  });

  it('refuses an empty list instead of reporting a fake score', () => {
    expect(() => medianReport([])).toThrow(/at least one/);
  });
});
