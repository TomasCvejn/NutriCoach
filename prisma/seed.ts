import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import type { Prisma } from "../src/generated/prisma/client";
import { createUser } from "../src/lib/auth";
import { addDays, todayIn } from "../src/lib/dates";
import { db, dbUrl } from "../src/lib/db";
import { CHECK_IN_SCALES, type HistoryPayloads, ONBOARDING_STEPS } from "../src/lib/enums";
import { currentDueDate } from "../src/lib/check-ins";
import { nutrientsOf } from "../src/lib/food-log";
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
        allergens: ["GLUTEN"],
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
        onboardingCompletedAt: daysAgo(56), // eight weeks of check-ins
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
  // Everyone has finished onboarding, two weeks ago (race@ a day later, sports@ eight weeks ago).
  const onboarded = { onboardingStep: ONBOARDING_STEPS.length - 1, onboardingCompletedAt: daysAgo(14) };
  for (const { profile, ...user } of clients) {
    await createUser({ ...user, role: "CLIENT", client: { create: { ...onboarded, ...profile, coachId: coach.id } } });
  }
  // The coach hasn't read race@'s onboarding notification yet (the bell shows 1).
  for (const [email, days, read] of [["general@demo.cz", 14, true], ["sports@demo.cz", 56, true], ["race@demo.cz", 13, false]] as const) {
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
        { name: "Domácí granola", brand: "Jana Horáková", kcal: 455, protein: 12, carbs: 58, fat: 19, fiber: 8, servings: [{ label: "1 hrst", grams: 40 }] },
        { name: "Tvarohová pomazánka s pažitkou", kcal: 135, protein: 14, carbs: 4, fat: 7, sodium: 380, servings: [{ label: "1 lžíce", grams: 20 }] },
        { name: "Recovery shake (coach mix)", kcal: 78, protein: 8, carbs: 11, fat: 0.5, sodium: 120, servings: [{ label: "1 shaker", grams: 500 }] },
        { name: "Overnight oats", kcal: 165, protein: 7, carbs: 24, fat: 4.5, fiber: 3.5, servings: [{ label: "1 jar", grams: 250 }] },
      ].map((food) => ({ ...food, source: "COACH", ownerId: coach.id })),
      {
        ...{ source: "CLIENT", ownerId: sportsUser.id, name: "Lactose-free skyr", brand: "Arla" },
        ...{ kcal: 63, protein: 11, carbs: 4, fat: 0.2, sodium: 40, servings: [{ label: "1 pot", grams: 150 }] },
      },
    ],
  });

  // CALORIES food logs for sports@ and race@: the 13 days before today (today is left to log). Lunch and dinner scale by
  // the day's factor, so a few days miss the ±10 % kcal window; null = nothing logged that day.
  const byName = async (name: string) => db.food.findFirstOrThrow({ where: { name } });
  const [oats, granola, spread, skyr] = await Promise.all(["Overnight oats", "Domácí granola", "Tvarohová pomazánka s pažitkou", "Lactose-free skyr"].map(byName));
  type Item = [slot: string, food: Awaited<ReturnType<typeof byName>> | [name: string, kcal: number, protein: number, carbs: number, fat: number], grams?: number, scales?: boolean];
  const logs: { clientId: string; factors: (number | null)[]; items: Item[] }[] = [
    {
      clientId: sports,
      factors: [1, 0.96, 1.04, 1, 0.75, 1.02, 1, null, 0.98, 1.2, 1, 1.03, 0.97],
      items: [
        ["Breakfast", oats, 350],
        ["Snack", skyr, 150],
        ["Snack", granola, 40],
        ["Lunch", ["Rice, salmon and vegetables", 700, 40, 80, 22], undefined, true],
        ["Dinner", ["Pasta with tuna", 650, 38, 85, 15], undefined, true],
      ],
    },
    {
      clientId: race,
      factors: [1.02, 1, 0.97, 1.05, 1, null, 0.8, 1, 1.03, 0.99, 1.15, 1, 0.98],
      items: [
        ["Snídaně", oats, 300],
        ["Svačina", spread, 60],
        ["Svačina", ["Rýžové chlebíčky", 150, 3, 32, 1]],
        ["Oběd", ["Těstoviny s vejci a zeleninou", 650, 35, 85, 15], undefined, true],
        ["Večeře", ["Rýže s tofu a zeleninou", 600, 35, 70, 18], undefined, true],
        ["Večerní svačina", ["Tvaroh", 150, 18, 6, 5]],
      ],
    },
  ];
  // Training sessions (sports@ and race@ train; general@ doesn't): the past ones with how they went, none today (so today
  // stays a rest day), the coming week planned. A session makes its day a training day, so those days' logs carry a
  // recovery drink on top and meet the training-day targets.
  type Session = [daysFromToday: number, type: string, durationMin: number, intensity: string, startTime: string, description?: string, rpe?: number, felt?: number];
  const training: [clientId: string, sessions: Session[], shake: Item][] = [
    [
      sports,
      [
        [-12, "BIKE", 90, "MODERATE", "17:30", undefined, 5, 7],
        [-7, "BIKE", 150, "HIGH", "08:00", "Long ride, last hour at race pace", 8, 6],
        [-4, "RUN", 60, "MODERATE", "06:30", undefined, 6, 8],
        [-2, "SWIM", 45, "MODERATE", "07:00", "Drills + 10×100 m", 5, 8],
        [1, "BIKE", 120, "HIGH", "17:00", "3×10 min tempo"],
        [3, "RUN", 50, "MODERATE", "06:30"],
        [5, "SWIM", 45, "LOW", "07:00"],
      ],
      ["Snack", ["Recovery shake", 500, 30, 75, 8]],
    ],
    [
      race,
      [
        [-12, "RUN", 45, "LOW", "06:00", undefined, 3, 8],
        [-10, "RUN", 75, "HIGH", "17:30", "Intervaly 6×1 km", 8, 7],
        [-8, "RUN", 130, "MODERATE", "08:00", "Dlouhý běh", 7, 6],
        [-5, "STRENGTH", 40, "MODERATE", "18:00", undefined, 5, 8],
        [-3, "RUN", 60, "HIGH", "17:30", "Tempo 3×3 km", 8, 8],
        [-1, "RUN", 45, "LOW", "06:00", "Klusání", 3, 9],
        [1, "RUN", 60, "HIGH", "17:30", "Intervaly 6×800 m"],
        [3, "RUN", 45, "LOW", "06:00"],
        [4, "STRENGTH", 40, "MODERATE", "18:00"],
        [6, "RUN", 120, "MODERATE", "08:00", "Dlouhý běh v závodním tempu"],
      ],
      ["Svačina", ["Regenerační nápoj", 500, 30, 75, 8]],
    ],
  ];
  await db.trainingSession.createMany({
    data: training.flatMap(([clientId, sessions]) =>
      sessions.map(([days, type, durationMin, intensity, startTime, description, rpe, felt]) => ({ clientId, date: addDays(today, days), type, durationMin, intensity, startTime, description, rpe, felt })),
    ),
  });
  const shakeOn = (clientId: string, date: string): Item[] => {
    const [, sessions, shake] = training.find(([id]) => id === clientId) ?? [];
    return sessions?.some(([days]) => addDays(today, days) === date) ? [shake!] : [];
  };

  await db.foodEntry.createMany({
    data: logs.flatMap(({ clientId, factors, items }) =>
      factors.flatMap((factor, i) => {
        if (factor == null) return [];
        const date = addDays(today, -(i + 1));
        return [...items, ...shakeOn(clientId, date)].map(([slot, food, grams, scales]) => {
          if (!Array.isArray(food)) return { clientId, date, slot, foodId: food.id, name: food.name, brand: food.brand, grams, ...nutrientsOf(food, grams!) };
          const [name, kcal, protein, carbs, fat] = food;
          const f = scales ? factor : 1;
          return { clientId, date, slot, name, kcal: Math.round(kcal * f), protein: Math.round(protein * f), carbs: Math.round(carbs * f), fat: Math.round(fat * f) };
        });
      }),
    ),
  });

  // PORTIONS logs for general@: the plan's portions most days, the snack skipped on two (carbs then miss by 2), a bigger
  // dinner once, two days not logged; today is left to log.
  const planned: Record<string, [number, number, number, number]> = { Snídaně: [1, 1, 1, 1], Oběd: [2, 1, 2, 1], Svačina: [1, 1, 0, 1], Večeře: [2, 1, 2, 1] };
  const days = ["full", "full", "noSnack", "full", null, "full", "big", "full", "noSnack", "full", "full", null, "full"] as const;
  await db.portionLog.createMany({
    data: days.flatMap((kind, i) =>
      kind == null
        ? []
        : Object.entries(planned)
            .filter(([slot]) => !(kind === "noSnack" && slot === "Svačina"))
            .map(([slot, [palms, hands, fists, thumbs]]) => ({
              ...{ clientId: general, date: addDays(today, -(i + 1)), slot, fists, thumbs },
              ...(kind === "big" && slot === "Večeře" ? { palms: palms + 1, hands: hands + 1 } : { palms, hands }),
            })),
    ),
  });

  // GUIDANCE marks for general@ too, shown when the coach switches the mode (switching never deletes data).
  const marks = ["YES", "YES", "PARTLY", "YES", null, "YES", "NO", "YES", "PARTLY", "YES", "YES", null, "YES"] as const;
  await db.guidanceLog.createMany({
    data: marks.flatMap((lunch, i) =>
      lunch == null
        ? []
        : ["Snídaně", "Oběd", "Svačina", "Večeře"].map((slot) => ({ clientId: general, date: addDays(today, -(i + 1)), slot, followed: slot === "Oběd" ? lunch : "YES" })),
    ),
  });

  // Recipes (cs and en) from basic library foods; one has a text ingredient (incomplete nutrition), one is a draft.
  const basics = [
    { name: "Ovesné vločky", kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, fiber: 10 },
    { name: "Banán", kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sodium: 1 },
    { name: "Borůvky", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, sodium: 1 },
    { name: "Med", kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
    { name: "Rýže jasmínová, vařená", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, sodium: 1 },
    { name: "Losos, pečený", kcal: 208, protein: 20, carbs: 0, fat: 13, sodium: 60 },
    { name: "Řecký jogurt bez laktózy", kcal: 97, protein: 9, carbs: 4, fat: 5, sodium: 40 },
  ];
  await db.food.createMany({ data: basics.map((food) => ({ ...food, source: "COACH", ownerId: coach.id })) });
  const food = async (name: string) => (await db.food.findFirstOrThrow({ where: { name, ownerId: coach.id } })).id;
  const [oatsF, bananaF, blueberriesF, honeyF, riceF, salmonF, yoghurtF] = await Promise.all(basics.map((b) => food(b.name)));
  const recipe = (data: Omit<Prisma.RecipeUncheckedCreateInput, "coachId">) => db.recipe.create({ data: { ...data, coachId: coach.id } });
  const porridge = await recipe({
    name: "Ovesná kaše s banánem a borůvkami",
    status: "PUBLISHED",
    ...{ categories: ["BREAKFAST", "PRE_TRAINING"], prepMinutes: 10, servings: 1, dietFlags: ["VEGETARIAN"], allergens: ["GLUTEN"] },
    ingredients: [
      { foodId: oatsF, name: "Ovesné vločky", grams: 60 },
      { foodId: bananaF, name: "Banán", grams: 120 },
      { foodId: blueberriesF, name: "Borůvky", grams: 80 },
      { foodId: honeyF, name: "Med", grams: 10 },
      { name: "Špetka skořice" },
    ],
    steps: ["Vločky zalijte 200 ml vody a 5 minut vařte.", "Vmíchejte rozmačkanou polovinu banánu.", "Ozdobte zbytkem banánu a borůvkami, pokapejte medem."],
    substitutions: [{ instead: "Banán", use: "Strouhané jablko", note: "Méně sacharidů" }],
  });
  await recipe({
    name: "Rýžový bowl s lososem",
    status: "PUBLISHED",
    ...{ categories: ["LUNCH", "DINNER", "POST_TRAINING"], prepMinutes: 25, servings: 2, dietFlags: ["GLUTEN_FREE", "LACTOSE_FREE"], allergens: ["FISH"] },
    ingredients: [
      { foodId: riceF, name: "Rýže jasmínová, vařená", grams: 300 },
      { foodId: salmonF, name: "Losos, pečený", grams: 250 },
    ],
    steps: ["Lososa pečte 15 minut na 200 °C.", "Podávejte na rýži se zeleninou podle chuti."],
    substitutions: [{ instead: "Losos", use: "Tofu", note: "Pro vegetariány" }],
  });
  const overnight = await recipe({
    name: "Overnight oats with berries",
    status: "PUBLISHED",
    ...{ categories: ["BREAKFAST"], prepMinutes: 5, servings: 1, dietFlags: ["VEGETARIAN", "LACTOSE_FREE"], allergens: ["GLUTEN", "MILK"] },
    ingredients: [
      { foodId: oatsF, name: "Oats", grams: 50 },
      { foodId: yoghurtF, name: "Lactose-free Greek yoghurt", grams: 150 },
      { foodId: blueberriesF, name: "Blueberries", grams: 100 },
      { foodId: honeyF, name: "Honey", grams: 10 },
    ],
    steps: ["Stir the oats into the yoghurt with 50 ml water.", "Leave in the fridge overnight.", "Top with blueberries and honey."],
    substitutions: [],
  });
  await recipe({
    name: "Pre-race rice cakes",
    status: "DRAFT",
    ...{ categories: ["PRE_TRAINING", "COMPETITION"], prepMinutes: 40, servings: 8, dietFlags: ["VEGAN", "VEGETARIAN", "GLUTEN_FREE", "LACTOSE_FREE"], allergens: [] },
    ingredients: [
      { foodId: riceF, name: "Cooked jasmine rice", grams: 400 },
      { foodId: honeyF, name: "Honey", grams: 30 },
      { name: "A pinch of salt" },
    ],
    steps: ["Mix the warm rice with honey and salt.", "Press into a tin, chill and cut into 8 bars."],
    substitutions: [{ instead: "Honey", use: "Maple syrup", note: "Truly vegan" }],
  });

  // Recipe options on plan meals: race@'s breakfasts, sports@'s rest-day breakfast.
  await db.planMeal.updateMany({ where: { clientId: race, name: "Snídaně" }, data: { recipeIds: [porridge.id] } });
  await db.planMeal.updateMany({ where: { clientId: sports, dayType: "REST", name: "Breakfast" }, data: { recipeIds: [overnight.id] } });

  // Hydration: 13 days of drinks around each client's fluid target (today left empty), and sports@'s saved drink.
  const drinks: [clientId: string, ml: number[], electrolyte?: boolean][] = [
    [general, [500, 500, 250, 500, 500, 250, 500]],
    [sports, [500, 250, 500, 250, 500], true],
    [race, [500, 500, 250, 500, 250]],
  ];
  await db.fluidLog.createMany({
    data: drinks.flatMap(([clientId, amounts, electrolyte]) =>
      Array.from({ length: 13 }, (_, i) => addDays(today, -(i + 1))).flatMap((date, day) => [
        ...amounts.slice(0, amounts.length - (day % 3 === 1 ? 1 : 0)).map((ml, k) => ({ clientId, date, ml, drinkType: "WATER", createdAt: new Date(`${date}T${String(7 + k * 2).padStart(2, "0")}:00:00Z`) })),
        ...(electrolyte ? [{ clientId, date, ml: 500, drinkType: "ELECTROLYTE", sodium: 300, carbs: 30, createdAt: new Date(`${date}T17:30:00Z`) }] : []),
      ]),
    ),
  });
  await db.drinkPreset.create({ data: { clientId: sports, name: "Electrolyte mix", ml: 500, drinkType: "ELECTROLYTE", sodium: 300, carbs: 30 } });

  // Check-ins (Monday): the earlier periods reviewed (race@ hasn't opened the last feedback yet); sports@ has sent the
  // current one (waiting for review, its notification already read), general@ and race@ still owe theirs, so their home
  // shows the reminder.
  const answers = (scores: number[], comments: Record<string, string> = {}) =>
    Object.fromEntries(CHECK_IN_SCALES.map((scale, i) => [scale, { score: scores[i], comment: comments[scale] ?? null }]));
  const DRIFT = [[1, 0, 2, 1, 0, 1, 1], [0, 1, 1, 2, 1, 0, 1], [2, 1, 0, 1, 2, 1, 0], [1, 2, 1, 0, 1, 2, 2], [0, 1, 2, 1, 0, 1, 1], [1, 0, 1, 2, 1, 0, 2], [2, 1, 1, 1, 2, 1, 1]]; // per week back, per scale
  // Each with the feedback on the reviewed ones (the last one in full, the earlier ones a line), in the client's language.
  const sets: [clientId: string, onboardedDaysAgo: number, scores: number[], comments: Record<string, string>, questions: string | null, feedback: [string, string, string]][] = [
    [general, 14, [6, 5, 7, 8, 6, 7, 7], { hunger: "Večer hlad na sladké." }, "Můžu si dát večer ovoce místo sušenky?", ["Pěkný týden, talíř se daří skládat. Hlad večer hlídejte bílkovinou u večeře.", "K večeři přidejte tvaroh nebo vejce.", "Stabilní týden, pokračujeme beze změn."]],
    [sports, 56, [7, 6, 6, 8, 8, 8, 8], { recovery: "Long ride on Saturday, legs heavy on Sunday." }, "Should I add carbs before the Wednesday intervals?", ["Solid week. Recovery dips after the long ride, so the carbs after it matter most.", "Recovery meal within an hour of the long ride.", "Steady week, no changes."]],
    [race, 13, [8, 7, 7, 6, 9, 8, 8], { digestion: "Na dlouhém běhu trochu nafouknutá." }, null, ["Trénink jede, trávení na dlouhém běhu vyřešíme testováním gelů.", "Na příštím dlouhém běhu zkuste půlku gelu po 40 minutách.", "Stabilní týden, pokračujeme beze změn."]],
  ];
  for (const [clientId, onboardedDaysAgo, scores, comments, questions, [response, nextSteps, steady]] of sets) {
    const current = currentDueDate(today, 1, addDays(today, -onboardedDaysAgo))!;
    for (let week = 7; week >= 1; week--) {
      const dueDate = addDays(current, -7 * week);
      if (dueDate < addDays(today, -onboardedDaysAgo)) continue;
      // Scores wander below this week's, differently per scale and a step lower in the first weeks, so each trend has a shape.
      const past = answers(scores.map((v, i) => Math.max(1, v - DRIFT[week - 1][i] - (week >= 5 ? 1 : 0))));
      const feedback = week === 1 ? { response, nextSteps } : { response: steady };
      const unread = clientId === race && week === 1; // race@'s home shows the new feedback
      await db.checkIn.create({ data: { clientId, dueDate, answers: past, ...feedback, createdAt: new Date(`${dueDate}T08:30:00Z`), reviewedAt: daysAgo(7 * week - 2), feedbackSeenAt: unread ? null : daysAgo(7 * week - 3) } });
    }
    if (clientId === sports) {
      const sent = await db.checkIn.create({ data: { clientId, dueDate: current, answers: answers(scores, comments), questions, createdAt: new Date(Math.min(Date.parse(`${current}T08:30:00Z`), Date.now() - 3_600_000)) } }); // never after now, on the due day itself
      await db.notification.create({ data: { userId: coach.id, type: "CHECK_IN_SUBMITTED", payload: { client: "Emma Walker", checkInId: sent.id } satisfies NotificationPayloads["CHECK_IN_SUBMITTED"], readAt: new Date() } });
    }
  }

  // Body composition about monthly; each client's latest weigh-in is their profile weight (the targets' g/kg use it).
  await db.bodyComp.createMany({
    data: [
      { clientId: general, date: addDays(today, -56), method: "SCALE", weightKg: 97.2, waistCm: 106 },
      { clientId: general, date: addDays(today, -28), method: "SCALE", weightKg: 95.8, waistCm: 104 },
      { clientId: general, date: addDays(today, -7), method: "SCALE", weightKg: 94.5, waistCm: 102.5, note: "Ráno nalačno." },
      { clientId: sports, date: addDays(today, -56), method: "BIOIMPEDANCE", weightKg: 62.4, bodyFatPct: 21, waistCm: 69.5, hipsCm: 93, thighCm: 55 },
      { clientId: sports, date: addDays(today, -28), method: "BIOIMPEDANCE", weightKg: 61.8, bodyFatPct: 20.2 },
      { clientId: sports, date: addDays(today, -3), method: "BIOIMPEDANCE", weightKg: 61.2, bodyFatPct: 19.6, waistCm: 68, hipsCm: 92, thighCm: 54 },
      { clientId: race, date: addDays(today, -30), method: "DEXA", weightKg: 58.9, bodyFatPct: 18.4, leanMassKg: 46.1 },
      { clientId: race, date: addDays(today, -6), method: "SCALE", weightKg: 58.4 },
    ],
  });

  // One pending invite (accept it at /invite/demo-invite with dev accept).
  await db.invite.create({
    data: { coachId: coach.id, token: "demo-invite", name: "Martin Beneš", email: "martin@demo.cz", expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
}

seed().then(() => console.log("Seeded demo data (sign in with dev login)."));
