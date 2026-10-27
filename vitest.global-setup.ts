import { execSync } from "node:child_process";

// Every run starts from a fresh, seeded test.db (same full reset as `npm run db:seed`).
export default function setup() {
  execSync("npm run db:seed", { stdio: "pipe", env: { ...process.env, DATABASE_URL: "file:./test.db" } });
}
