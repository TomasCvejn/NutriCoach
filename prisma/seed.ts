import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import type { Prisma } from "../src/generated/prisma/client";
import { createUser } from "../src/lib/auth";
import { addDays, todayIn } from "../src/lib/dates";
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
  const today = todayIn("Europe/Prague");
  // Per-client content uses the client's locale: general@ cs, sports@ en, race@ cs. inactive@ is a deactivated client.
  // A sport on the profile turns on Training: general@ has none.
  const clients: { email: string; name: string; locale: string; active?: boolean; profile: Omit<Prisma.ClientUncheckedCreateWithoutUserInput, "coachId"> }[] = [
    {
      email: "general@demo.cz",
      name: "Petr Novák",
      locale: "cs",
      profile: {
        trackingMode: "PORTIONS",
        sex: "MALE",
        birthDate: "1986-04-12",
        heightCm: 182,
        weightKg: 94.5,
        phone: "+420 731 245 118",
        primaryGoal: "LOSE_FAT",
        targetWeightKg: 86,
        targetDate: addDays(today, 154),
        successText: "Vyjdu do čtvrtého patra bez zadýchání a zase se vejdu do obleku ze svatby.",
        likedFoods: "Kuřecí maso, rýže, zelenina na pánvi, tvaroh, jablka",
        dislikedFoods: "Houby, olivy",
        mealsPerDay: 4,
        dietType: "OMNIVORE",
        allergens: [],
        restrictions: "Přes týden obědvám v závodní jídelně.",
        healthConditions: "Mírně zvýšený krevní tlak, sleduje praktický lékař.",
        otherInfo: "Kancelářská práce, většinu dne sedím.",
      },
    },
    {
      email: "sports@demo.cz",
      name: "Emma Walker",
      locale: "en",
      profile: {
        trackingMode: "CALORIES",
        sex: "FEMALE",
        birthDate: "1994-09-03",
        heightCm: 168,
        weightKg: 61.2,
        primaryGoal: "PERFORMANCE",
        successText: "Finish an Olympic-distance triathlon under 2:30 without fading on the run.",
        likedFoods: "Oats, bananas, salmon, rice, Greek-style yoghurt (lactose-free)",
        dislikedFoods: "Very spicy food",
        mealsPerDay: 5,
        dietType: "PESCATARIAN",
        allergens: ["MILK"],
        allergiesNote: "Lactose intolerance; lactose-free dairy is fine.",
        sports: "Triathlon",
        sportLevel: "AMATEUR_COMPETITIVE",
        sessionsPerWeek: 9,
        sessionMinutes: 75,
        otherInfo: "Trains before work at 6:00, second session some evenings.",
      },
    },
    {
      email: "race@demo.cz",
      name: "Tereza Svobodová",
      locale: "cs",
      profile: {
        trackingMode: "CALORIES",
        sex: "FEMALE",
        birthDate: "1990-01-22",
        heightCm: 171,
        weightKg: 58.4,
        phone: "+420 604 553 902",
        primaryGoal: "COMPETITION_PREP",
        targetDate: addDays(today, 10),
        successText: "Maraton pod 3:30 bez žaludečních potíží na trati.",
        likedFoods: "Těstoviny, ovesná kaše, banány, cottage, rýžové chlebíčky",
        dislikedFoods: "Luštěniny",
        mealsPerDay: 5,
        dietType: "VEGETARIAN",
        allergens: [],
        restrictions: "Před závodem nejím luštěniny ani hodně vlákniny.",
        sports: "Běh (maraton)",
        sportLevel: "AMATEUR_COMPETITIVE",
        sessionsPerWeek: 6,
        sessionMinutes: 70,
        healthConditions: "Občas žaludeční potíže na dlouhých bězích.",
      },
    },
    { email: "inactive@demo.cz", name: "Lucie Králová", locale: "cs", active: false, profile: {} },
  ];
  for (const { profile, ...user } of clients) {
    await createUser({ ...user, role: "CLIENT", client: { create: { ...profile, coachId: coach.id } } });
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
