import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    globalSetup: ["./vitest.global-setup.ts"],
    // One test.db for every file: parallel workers are separate SQLite connections, and a transaction that upgrades
    // from read to write while another worker writes fails at once with SQLITE_BUSY ("Operation has timed out").
    fileParallelism: false,
    // Fake Google credentials turn the provider on; auth.test.ts mocks Google's token endpoint.
    env: {
      DATABASE_URL: "file:./test.db",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  },
});
