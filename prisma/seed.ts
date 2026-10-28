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

  // Nutrition targets from onboarding on; general@'s portion targets came with the mode change a week ago (calories carried over).
  const from = addDays(today, -14);
  const target = (clientId: string, dayType: string, effectiveFrom: string, values: object) => ({ clientId, dayType, effectiveFrom, ...values });
  const generalCalories = { kcal: 2300, protein: 170, carbs: 230, fat: 75, fluidMl: 3300 };
  await db.nutritionTarget.createMany({
    data: [
      target(general, "REST", from, generalCalories),
      target(general, "REST", addDays(today, -7), { ...generalCalories, palms: 6, hands: 5, fists: 6, thumbs: 4 }),
      target(sports, "REST", from, { kcal: 2200, protein: 120, carbs: 280, fat: 65, fiber: 30, fluidMl: 2150 }),
      target(sports, "TRAINING", from, { kcal: 2700, protein: 125, carbs: 390, fat: 70, fiber: 30, fluidMl: 2650 }),
      target(race, "REST", from, { kcal: 2100, protein: 110, carbs: 270, fat: 62, fluidMl: 2050 }),
      target(race, "TRAINING", from, { kcal: 2600, protein: 115, carbs: 380, fat: 65, fluidMl: 2500 }),
      target(race, "COMPETITION", from, { kcal: 2900, protein: 100, carbs: 500, fat: 55, fluidMl: 2500 }),
    ],
  });
  const targetsSet = (clientId: string, date: string, dayTypes: HistoryPayloads["TARGETS"]["dayTypes"], days: number) =>
    ({ clientId, type: "TARGETS", date, payload: { effectiveFrom: date, dayTypes } satisfies HistoryPayloads["TARGETS"], createdAt: daysAgo(days) });
  await db.historyEvent.createMany({
    data: [
      targetsSet(general, from, ["REST"], 14),
      targetsSet(general, addDays(today, -7), ["REST"], 7),
      targetsSet(sports, from, ["REST", "TRAINING"], 14),
      targetsSet(race, from, ["REST", "TRAINING", "COMPETITION"], 14),
    ],
  });

  // Plans: meals per day type (in order), recommendations and specifics, in the client's language.
  type SeedMeal = [name: string, timeHint: string, guidance: string, portions?: [number, number, number, number]];
  const meals = (clientId: string, dayType: string, list: SeedMeal[]) =>
    list.map(([name, timeHint, guidance, p], position) => ({
      ...{ clientId, dayType, position, name, timeHint, guidance },
      ...(p && { palms: p[0], hands: p[1], fists: p[2], thumbs: p[3] }),
    }));
  await db.planMeal.createMany({
    data: [
      ...meals(general, "REST", [
        ["Snídaně", "10:00", "Vajíčka nebo tvaroh, kus pečiva, zelenina.", [1, 1, 1, 1]],
        ["Oběd", "13:30", "Maso nebo luštěniny, příloha, půl talíře zeleniny.", [2, 1, 2, 1]],
        ["Svačina", "16:30", "Jogurt nebo ovoce s hrstí ořechů.", [1, 1, 0, 1]],
        ["Večeře", "19:30", "Bílkoviny a zelenina, příloha jen malá.", [2, 1, 2, 1]],
      ]),
      ...meals(sports, "REST", [
        ["Breakfast", "7:00", "Oats with lactose-free yoghurt and fruit."],
        ["Lunch", "12:30", "Rice or potatoes, fish or tofu, vegetables."],
        ["Snack", "16:00", "Fruit and a handful of nuts."],
        ["Dinner", "19:30", "Protein, vegetables, a smaller portion of carbs."],
      ]),
      ...meals(sports, "TRAINING", [
        ["Pre-training", "5:30", "Banana or toast with honey, 300 ml water."],
        ["Recovery breakfast", "8:00", "Oats, yoghurt, fruit and eggs within an hour of the session."],
        ["Lunch", "12:30", "Rice or pasta, fish or tofu, vegetables."],
        ["Snack", "16:00", "Bagel with peanut butter."],
        ["Dinner", "19:30", "Protein, vegetables and potatoes."],
      ]),
      ...meals(race, "REST", [
        ["Snídaně", "7:00", "Ovesná kaše s banánem a cottage."],
        ["Oběd", "12:00", "Těstoviny nebo rýže, vejce či sýr, zelenina."],
        ["Svačina", "15:30", "Rýžové chlebíčky s cottage a ovocem."],
        ["Večeře", "19:00", "Brambory, tofu nebo vejce, zelenina."],
        ["Večerní svačina", "21:00", "Tvaroh nebo jogurt."],
      ]),
      ...meals(race, "TRAINING", [
        ["Před tréninkem", "6:00", "Rýžový chlebíček s medem, 300 ml vody."],
        ["Snídaně", "8:00", "Ovesná kaše, banán, cottage do hodiny po tréninku."],
        ["Oběd", "12:00", "Těstoviny, vejce, zelenina."],
        ["Svačina", "15:30", "Banán a jogurt."],
        ["Večeře", "19:00", "Rýže, tofu, zelenina."],
      ]),
      ...meals(race, "COMPETITION", [
        ["Snídaně", "3 h před startem", "Bílé pečivo s medem nebo rýže, 500 ml iontového nápoje."],
        ["Před startem", "30 min před startem", "Gel a 200 ml vody."],
        ["Po závodě", "do 30 min", "Sacharidy a bílkoviny: recovery nápoj nebo jogurt s banánem."],
        ["Večeře", "19:00", "Těstoviny se sýrem, zelenina."],
      ]),
    ],
  });
  const recommendations = (clientId: string, list: [string, string][]) => list.map(([title, text], position) => ({ clientId, position, title, text }));
  await db.planRecommendation.createMany({
    data: [
      ...recommendations(general, [
        ["Bílkoviny v každém jídle", "Dlaň masa, ryby, vajec nebo tvarohu ke každému hlavnímu jídlu."],
        ["Sladké večer naplánovat", "Když je chuť na sladké, dejte si ho po večeři, ne místo ní."],
      ]),
      ...recommendations(sports, [
        ["Carbs around training", "Most of the day's carbs before, during and after sessions."],
        ["Lactose-free dairy", "Choose lactose-free yoghurt and milk; hard cheese is fine."],
      ]),
      ...recommendations(race, [
        ["Bez luštěnin 3 dny před závodem", "Luštěniny a hodně vlákniny vynechat od středy."],
        ["Pít průběžně", "Každou hodinu sklenici vody, při tréninku podle plánu fuelingu."],
      ]),
    ],
  });
  for (const [clientId, planSpecifics] of [
    [general, "Pracuje na směny: po noční směně se snídaně posouvá na 14:00 a oběd vynechává."],
    [sports, "Early sessions at 6:00: keep the pre-training snack small and easy to digest."],
    [race, "Občasné žaludeční potíže na dlouhých bězích: nové gely zkoušet jen na tréninku."],
  ]) {
    await db.client.update({ where: { id: clientId }, data: { planSpecifics } });
  }

  // Foods: the coach's library (cs and en) and one food sports@ made for herself.
  const sportsUser = await db.user.findUniqueOrThrow({ where: { email: "sports@demo.cz" } });
  await db.food.createMany({
    data: [
      ...[
        { name: "Domácí granola", brand: "Jana Horáková", kcal: 455, protein: 12, carbs: 58, fat: 19, fiber: 8, sugar: 14, servings: [{ label: "1 hrst", grams: 40 }] },
        { name: "Tvarohová pomazánka s pažitkou", kcal: 135, protein: 14, carbs: 4, fat: 7, sodium: 380, servings: [{ label: "1 lžíce", grams: 20 }] },
        { name: "Recovery shake (coach mix)", kcal: 78, protein: 8, carbs: 11, fat: 0.5, sodium: 120, servings: [{ label: "1 shaker", grams: 500 }] },
        { name: "Overnight oats", kcal: 165, protein: 7, carbs: 24, fat: 4.5, fiber: 3.5, servings: [{ label: "1 jar", grams: 250 }] },
      ].map((food) => ({ ...food, source: "COACH", ownerId: coach.id })),
      {
        ...{ source: "CLIENT", ownerId: sportsUser.id, name: "Lactose-free skyr", brand: "Arla" },
        ...{ kcal: 63, protein: 11, carbs: 4, fat: 0.2, calcium: 110, servings: [{ label: "1 pot", grams: 150 }] },
      },
    ],
  });

  // One pending invite (accept it at /invite/demo-invite with dev accept).
  await db.invite.create({
    data: { coachId: coach.id, token: "demo-invite", name: "Martin Beneš", email: "martin@demo.cz", expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
}

seed().then(() => console.log("Seeded demo data (sign in with dev login)."));
