import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  // `next dev` compiles a route on its first hit.
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  // settings.spec switches a demo client's language for a moment, so it runs on its own before the rest (which read the
  // demo clients' UI in Czech).
  projects: [
    { name: "settings", testMatch: /settings\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium", testIgnore: /settings\.spec\.ts/, dependencies: ["settings"], use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Fresh e2e.db on every run. `next dev`, not a production build: e2e signs in with dev login, which production refuses.
    command: `npm run db:seed && npx next dev -p ${port}`,
    url: `http://localhost:${port}`,
    // Beats a developer's .env (Next never overrides set variables).
    // Own build dir, so a developer's `npm run dev` can keep running. Open Food Facts points at a closed port: it fails
    // fast and the tests check the "unavailable" notice, so no test touches the network.
    env: { DATABASE_URL: "file:./e2e.db", BETTER_AUTH_URL: `http://localhost:${port}`, NEXT_DIST_DIR: ".next-e2e", OFF_BASE_URL: "http://127.0.0.1:9" },
    timeout: 300_000,
  },
});
