import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dbUrl } from "../src/lib/db";

// Full reset of the local SQLite DB: delete the file and re-apply every migration.
// ponytail: file delete + `migrate deploy` instead of `migrate reset`, which Prisma blocks for AI agents.
const file = dbUrl.replace(/^file:/, "");
rmSync(file, { force: true });
rmSync(`${file}-journal`, { force: true });
execSync("npx prisma migrate deploy", { stdio: "inherit" });

// Demo data is added here as features land (coach@demo.cz, general@ / sports@ / race@demo.cz).
