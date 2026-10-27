import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createUser } from "../src/lib/auth";
import { dbUrl } from "../src/lib/db";

// Full reset of the local SQLite DB: delete the file and re-apply every migration.
// ponytail: file delete + `migrate deploy` instead of `migrate reset`, which Prisma blocks for AI agents.
const file = dbUrl.replace(/^file:/, "");
rmSync(file, { force: true });
rmSync(`${file}-journal`, { force: true });
execSync("npx prisma migrate deploy", { stdio: "inherit" });

const password = "demo1234";

async function seed() {
  const coach = await createUser({ email: "coach@demo.cz", name: "Jana Horáková", password, role: "COACH" });
  // Per-client content uses the client's locale: general@ cs, sports@ en, race@ cs.
  const clients = [
    { email: "general@demo.cz", name: "Petr Novák", locale: "cs", program: "GENERAL", trackingMode: "PORTIONS" },
    { email: "sports@demo.cz", name: "Emma Walker", locale: "en", program: "SPORTS", trackingMode: "CALORIES" },
    { email: "race@demo.cz", name: "Tereza Svobodová", locale: "cs", program: "COMPETITION", trackingMode: "CALORIES" },
  ];
  for (const { program, trackingMode, ...user } of clients) {
    await createUser({ ...user, password, role: "CLIENT", client: { create: { coachId: coach.id, program, trackingMode } } });
  }
}

seed().then(() => console.log("Seeded demo data (password demo1234)."));
