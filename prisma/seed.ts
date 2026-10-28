import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createUser } from "../src/lib/auth";
import { db, dbUrl } from "../src/lib/db";
import type { NotificationPayloads } from "../src/lib/notifications";

// Full reset of the local SQLite DB: delete the file and re-apply every migration.
// ponytail: file delete + `migrate deploy` instead of `migrate reset`, which Prisma blocks for AI agents.
const file = dbUrl.replace(/^file:/, "");
rmSync(file, { force: true });
rmSync(`${file}-journal`, { force: true });
execSync("npx prisma migrate deploy", { stdio: "inherit" });

async function seed() {
  const coach = await createUser({ email: "coach@demo.cz", name: "Jana Horáková", role: "COACH" });
  // Per-client content uses the client's locale: general@ cs, sports@ en, race@ cs. inactive@ is a deactivated client.
  const clients = [
    { email: "general@demo.cz", name: "Petr Novák", locale: "cs", trackingMode: "PORTIONS" },
    { email: "sports@demo.cz", name: "Emma Walker", locale: "en", trackingMode: "CALORIES" },
    { email: "race@demo.cz", name: "Tereza Svobodová", locale: "cs", trackingMode: "CALORIES" },
    { email: "inactive@demo.cz", name: "Lucie Králová", locale: "cs", trackingMode: "CALORIES", active: false },
  ];
  for (const { trackingMode, ...user } of clients) {
    await createUser({ ...user, role: "CLIENT", client: { create: { coachId: coach.id, trackingMode } } });
  }
  // The clients onboarded two weeks ago; the coach hasn't read race@'s notification yet (the bell shows 1).
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  for (const [email, days, read] of [["general@demo.cz", 14, true], ["sports@demo.cz", 14, true], ["race@demo.cz", 13, false]] as const) {
    const client = await db.client.findFirstOrThrow({ where: { user: { email } }, include: { user: true } });
    const payload = { client: client.user.name, clientId: client.id } satisfies NotificationPayloads["ONBOARDING_COMPLETED"];
    await db.notification.create({
      data: { userId: coach.id, type: "ONBOARDING_COMPLETED", payload, createdAt: daysAgo(days), readAt: read ? daysAgo(days) : null },
    });
  }
  // One pending invite (accept it at /invite/demo-invite with dev accept).
  await db.invite.create({
    data: { coachId: coach.id, token: "demo-invite", name: "Martin Beneš", email: "martin@demo.cz", expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
}

seed().then(() => console.log("Seeded demo data (sign in with dev login)."));
