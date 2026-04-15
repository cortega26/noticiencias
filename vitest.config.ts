/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000, // 60s for full site scan
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/env.d.ts'],
      thresholds: {
        lines: 20,
        functions: 18,
      },
      reporter: ['text', 'html'],
      reportsDirectory: 'reports/coverage',
    },
  },
});
