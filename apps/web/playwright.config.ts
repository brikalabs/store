import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the storefront, driven against a real local stack: the
 * registry Worker (port 8787) and the store SSR app (port 3000), sharing the
 * same local D1/R2 state. `globalSetup` publishes the example plugins so the
 * `@brika/*` listings are present, then the specs exercise browse, detail,
 * localization, and the tarball-served assets through a real browser.
 *
 * Both dev servers are reused if already running, so an interactive
 * `bun run --filter @brika/registry dev` + `bun run --filter @brika/store-web dev`
 * session is picked up instead of being restarted.
 */
const REGISTRY_URL = "http://localhost:8787";
const STORE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: STORE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run dev",
      cwd: "../registry",
      url: `${REGISTRY_URL}/`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "bun run dev",
      url: `${STORE_URL}/`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { VITE_REGISTRY_URL: REGISTRY_URL },
    },
  ],
});
