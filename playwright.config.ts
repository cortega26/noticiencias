import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Noticiencias E2E tests.
 *
 * These tests build and serve a local production build (`dist/` via
 * `astro preview`) and gate PRs against it — never the live site. Live
 * production is checked separately and explicitly by
 * `npm run test:deploy` (scripts/post-deploy-check.js), after a deploy
 * has actually happened.
 *
 * A previous version of this file defaulted to `https://noticiencias.com`
 * and skipped starting a local server entirely in CI — meaning a CI run
 * would have silently exercised the live site instead of the build being
 * gated. Confirmed by reproducing it locally: several report-form
 * assertions written against this repo's `config.yaml` (no report
 * endpoint configured) failed when accidentally pointed at the live site,
 * which has since diverged, and passed once correctly pointed at the
 * local build.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321';

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
      name: 'mobile-375',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Always start (or reuse, outside CI) a local preview server against the
  // current dist/ build — in CI as much as locally. There is no live-site
  // fallback here.
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
