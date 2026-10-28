import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import type { Prisma } from "../src/generated/prisma/client";
import { createUser } from "../src/lib/auth";
import { addDays, todayIn } from "../src/lib/dates";
import { db, dbUrl } from "../src/lib/db";
import { type HistoryPayloads, ONBOARDING_STEPS } from "../src/lib/enums";
import type { NotificationPayloads } from "../src/lib/notifications";

// Full reset of the local SQLite DB: delete the file and re-apply every migration.
// ponytail: file delete + `migrate deploy` instead of `migrate reset`, which Prisma blocks for AI agents.
const file = dbUrl.replace(/^file:/, "");
rmSync(file, { force: true });
rmSync(`${file}-journal`, { force: true });
execSync("npx prisma migrate deploy", { stdio: "inherit" });

async function seed() {
  const welcomeText =
    "Dobrý den a vítejte!\n\nJsem Jana a pomáhám hlavně vytrvalcům a lidem, kteří chtějí zhubnout bez hladovění. Odpovězte mi prosím na pár otázek o sobě – podle nich vám do dvou dnů připravím plán na míru.";
  const coach = await createUser({ email: "coach@demo.cz", name: "Jana Horáková", role: "COACH", welcomeText });
  const today = todayIn("Europe/Prague");
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Per-client content uses the client's locale: general@ cs, sports@ en, race@ cs. inactive@ is a deactivated client.
  // A sport on the profile turns on Training: general@ has none.
  const clients: { email: string; name: string; locale: string; active?: boolean; profile: Omit<Prisma.ClientUncheckedCreateWithoutUserInput, "coachId"> }[] = [
    {
      email: "general@demo.cz",
      name: "Petr Novák",
      locale: "cs",
      profile: {
        trackingMode: "PORTIONS",
        preferredTrackingMode: "PORTIONS",
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
        preferredTrackingMode: "CALORIES",
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
        preferredTrackingMode: "CALORIES",
        onboardingCompletedAt: daysAgo(13),
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
  // Everyone has finished onboarding, two weeks ago (race@ a day later).
  const onboarded = { onboardingStep: ONBOARDING_STEPS.length - 1, onboardingCompletedAt: daysAgo(14) };
  for (const { profile, ...user } of clients) {
    await createUser({ ...user, role: "CLIENT", client: { create: { ...onboarded, ...profile, coachId: coach.id } } });
  }
  // The coach hasn't read race@'s onboarding notification yet (the bell shows 1).
  for (const [email, days, read] of [["general@demo.cz", 14, true], ["sports@demo.cz", 14, true], ["race@demo.cz", 13, false]] as const) {
    const client = await db.client.findFirstOrThrow({ where: { user: { email } }, include: { user: true } });
    const payload = { client: client.user.name, clientId: client.id } satisfies NotificationPayloads["ONBOARDING_COMPLETED"];
    await db.notification.create({
      data: { userId: coach.id, type: "ONBOARDING_COMPLETED", payload, createdAt: daysAgo(days), readAt: read ? daysAgo(days) : null },
    });
  }
  // Coach notes and history (coach-only), in the client's language. general@ moved from CALORIES to PORTIONS a week ago.
  const [general, sports, race] = await Promise.all(
    ["general@demo.cz", "sports@demo.cz", "race@demo.cz"].map(async (email) => (await db.client.findFirstOrThrow({ where: { user: { email } } })).id),
  );
  const modeChange = { from: "CALORIES", to: "PORTIONS" } satisfies HistoryPayloads["TRACKING_MODE"];
  await db.historyEvent.create({ data: { clientId: general, type: "TRACKING_MODE", date: addDays(today, -7), payload: modeChange, createdAt: daysAgo(7) } });
  await db.coachNote.createMany({
    data: [
      { clientId: general, date: addDays(today, -12), type: "NOTE", text: "Úvodní hovor: pracuje na směny, snídá až kolem desáté. Večer chuť na sladké." },
      {
        clientId: general,
        date: addDays(today, -7),
        type: "DECISION",
        text: "Přechod z kalorií na porce rukou: vážení ho stresovalo a přestal zapisovat. Za dva týdny zhodnotit.",
        pinned: true,
      },
      { clientId: sports, date: addDays(today, -10), type: "NOTE", text: "Prefers simple meals on training days; batch-cooks on Sundays." },
      { clientId: sports, date: addDays(today, -3), type: "DECISION", text: "Carbs up to 7 g/kg on long-ride days; rest days stay at 4 g/kg." },
      { clientId: race, date: addDays(today, -9), type: "DECISION", text: "Sacharidové nasycení 3 dny před závodem, 8–10 g/kg. Vyzkoušet na dlouhém tréninkovém běhu.", pinned: true },
      { clientId: race, date: addDays(today, -5), type: "NOTE", text: "Gel snesla na 30 km bez potíží, kofeinový raději vynechat." },
    ],
  });

  // One pending invite (accept it at /invite/demo-invite with dev accept).
  await db.invite.create({
    data: { coachId: coach.id, token: "demo-invite", name: "Martin Beneš", email: "martin@demo.cz", expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
}

seed().then(() => console.log("Seeded demo data (sign in with dev login)."));
