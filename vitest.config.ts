/// <reference types="vitest" />
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/playwright/**'],
    testTimeout: 60000, // 60s for full site scan
    coverage: {
      provider: 'v8',
      // `src/**` only: Worker coverage is measured and thresholded
      // independently by `workers/vitest.config.ts` (plan 031 Step 3).
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        // Type-only declarations (interfaces/types), no runtime code to cover —
        // same class as a .d.ts file, just not named as one.
        'src/types/config.ts',
        // Owned and thresholded independently by workers/vitest.config.ts.
        'workers/**',
      ],
      reporter: ['text', 'html'],
      reportsDirectory: 'reports/coverage',
      // Per-file, no-regression floors recorded 2026-07-22 (plan 031 Step 1),
      // set at each file's own measured value so a single newly-uncovered
      // branch/line in an already-tested file fails the gate — a global-only
      // average is too coarse to catch that. Raise these as real coverage
      // improves; never lower a number to make a regression pass.
      //
      // Files not listed here (new modules) fall through to the lenient
      // `perFile` default below and should get their own entry once tested.
      thresholds: {
        perFile: true,
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,

        // Fully covered.
        'src/utils/categorySections.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/utils/frontmatter.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/utils/json-ld.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/utils/reportPayload.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/utils/safeFs.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/utils/utils.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/utils/browser/search-url.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/navigation.ts': { statements: 100, branches: 50, functions: 100, lines: 100 },
        'src/utils/date.ts': { statements: 100, branches: 92, functions: 100, lines: 100 },
        'src/utils/directories.ts': { statements: 100, branches: 50, functions: 100, lines: 100 },
        'src/utils/search.ts': { statements: 100, branches: 75, functions: 100, lines: 100 },
        'src/utils/normalizeImage.ts': { statements: 97, branches: 89, functions: 100, lines: 100 },
        'src/content.config.ts': { statements: 95, branches: 97, functions: 100, lines: 95 },
        'src/integration/utils/configBuilder.ts': {
          statements: 100,
          branches: 93,
          functions: 100,
          lines: 100,
        },
        'src/integration/utils/loadConfig.ts': {
          statements: 92,
          branches: 91,
          functions: 100,
          lines: 92,
        },
        'src/utils/hub.ts': { statements: 95, branches: 79, functions: 100, lines: 94 },
        'src/utils/permalinks.ts': { statements: 91, branches: 71, functions: 90, lines: 90 },
        'src/utils/blog.ts': { statements: 55, branches: 32, functions: 36, lines: 59 },
        'src/utils/image-derivatives.ts': {
          statements: 40,
          branches: 33,
          functions: 45,
          lines: 40,
        },

        // Accepted gaps, documented in plans/031/spec.md — not chased in this
        // pass. Real production code, deliberately kept in the denominator
        // (not excluded) so this stays visible in every coverage report.
        'src/utils/images-optimization.ts': { statements: 0, branches: 0, functions: 0, lines: 0 },
        'src/utils/images.ts': { statements: 0, branches: 0, functions: 0, lines: 0 },
        'src/pages/llms.txt.ts': { statements: 0, branches: 0, functions: 0, lines: 0 },
        'src/pages/llms-full.txt.ts': { statements: 0, branches: 0, functions: 0, lines: 0 },
        'src/integration/index.ts': { statements: 0, branches: 0, functions: 0, lines: 0 },
      },
    },
  },
});
