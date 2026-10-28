import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  // `next dev` compiles a route on its first hit.
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh e2e.db on every run. `next dev`, not a production build: e2e signs in with dev login, which production refuses.
    command: `npm run db:seed && npx next dev -p ${port}`,
    url: `http://localhost:${port}`,
    // Beats a developer's .env (Next never overrides set variables).
    // Own build dir, so a developer's `npm run dev` can keep running.
    env: { DATABASE_URL: "file:./e2e.db", BETTER_AUTH_URL: `http://localhost:${port}`, NEXT_DIST_DIR: ".next-e2e" },
    timeout: 300_000,
  },
});
