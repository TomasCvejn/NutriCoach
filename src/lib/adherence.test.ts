import { expect, test } from "vitest";
import { addDays, todayIn } from "./dates";
import { db } from "./db";
import { adherencePercent, nutritionSummaries } from "./adherence";

test("adherence %: adherent days of the days with a target; not logged counts against, no target is left out", () => {
  expect(adherencePercent(["ADHERENT", "ADHERENT", "MISSED", "NOT_LOGGED"])).toBe(50);
  expect(adherencePercent(["ADHERENT", null, null])).toBe(100);
  expect(adherencePercent(["ADHERENT", "ADHERENT", "MISSED"])).toBe(67);
  expect(adherencePercent([null, null])).toBeNull();
  expect(adherencePercent([])).toBeNull();
});

// The seed's last 7 days (see prisma/seed.ts): sports@ misses one day (lunch and dinner at 75 % → kcal −15 %); race@
// skips a day and misses one (−11 %); general@ skips the snack once (carbs −2 portions) and logs nothing on one day.
test("the seeded week gives the expected 7-day adherence and the last logged day for each demo client", async () => {
  const clients = await db.client.findMany({
    where: { user: { email: { in: ["sports@demo.cz", "race@demo.cz", "general@demo.cz", "inactive@demo.cz"] } } },
    select: { id: true, trackingMode: true, user: { select: { email: true, timezone: true } } },
  });
  const summaries = await nutritionSummaries(clients.map((c) => ({ id: c.id, trackingMode: c.trackingMode, timezone: c.user.timezone })));
  const of = (email: string) => summaries.get(clients.find((c) => c.user.email === email)!.id);
  const yesterday = addDays(todayIn("Europe/Prague"), -1);
  expect(of("sports@demo.cz")).toEqual({ adherence: 86, lastLogged: yesterday, daysAgo: 1 }); // 6 of 7
  expect(of("race@demo.cz")).toEqual({ adherence: 71, lastLogged: yesterday, daysAgo: 1 }); // 5 of 7
  expect(of("general@demo.cz")).toEqual({ adherence: 71, lastLogged: yesterday, daysAgo: 1 }); // 5 of 7
  expect(of("inactive@demo.cz")).toEqual({ adherence: null, lastLogged: null, daysAgo: null }); // no target, no logs
});
