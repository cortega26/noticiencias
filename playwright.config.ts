import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Noticiencias E2E tests.
 *
 * Targets the production site by default.
 * Override with PLAYWRIGHT_BASE_URL for local preview:
 *   PLAYWRIGHT_BASE_URL=http://localhost:4321 npx playwright test
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://noticiencias.com';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 15000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'npm run preview',
          url: 'http://localhost:4321',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
        },
      ],
});
