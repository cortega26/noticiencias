import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the GA4 consent flow (plan 009). `src/config.yaml` ships with
 * `googleAnalytics.id: null`, so the regular suite only ever sees "nothing
 * rendered". This config serves a separate build made with
 * `NOTICIENCIAS_GA_ID` set (`npm run build:consent-fixture` -> `dist-consent/`)
 * so the enabled branch is exercised for real. Google hosts are stubbed in the
 * tests: nothing here talks to the network.
 */
const PORT = 4322;

export default defineConfig({
  testDir: './tests/playwright-consent',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 15000,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    { name: 'mobile-375', use: { ...devices['Pixel 5'] } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs dist-consent ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
