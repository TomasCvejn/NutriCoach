import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    globalSetup: ["./vitest.global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", BETTER_AUTH_URL: "http://localhost:3000" },
  },
});
