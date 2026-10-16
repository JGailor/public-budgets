import { defineConfig, devices } from '@playwright/test';

// Browser checks against the built site, served the way Cloudflare serves it.
// Run `npm run build` first, or point E2E_BASE_URL at a deployed preview.
const PORT = 8788;
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: remote ?? `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote
    ? undefined
    : {
        command: `npx wrangler dev --port ${PORT} --log-level warn`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
