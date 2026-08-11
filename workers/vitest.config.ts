import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: { ENVIRONMENT: 'test' },
        r2Buckets: ['REPORT_BUCKET'],
        kvNamespaces: ['RATE_LIMIT_KV'],
      },
      wrangler: {
        configPath: './wrangler.toml',
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
