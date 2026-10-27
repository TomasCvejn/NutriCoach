import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh e2e.db on every run, production build so pages don't compile on first hit.
    command: `npm run db:seed && npx next build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    // `next start` is production: Better Auth refuses its default secret there.
    env: { DATABASE_URL: "file:./e2e.db", BETTER_AUTH_SECRET: "e2e-only-secret-never-used-in-production-4f9c2a7e" },
    timeout: 300_000,
  },
});
