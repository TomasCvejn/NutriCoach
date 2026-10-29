import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { checkInStatuses, currentCheckIn, notifyCheckInDue } from "@/lib/check-ins";
import { addDays, todayIn, weekday } from "@/lib/dates";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES } from "@/lib/enums";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { setCheckInWeekday, submitCheckIn } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const today = todayIn("Europe/Prague");
const answers = (score = "7") => ({ ...Object.fromEntries(CHECK_IN_SCALES.flatMap((s) => [[s, score], [`${s}Comment`, ""]])), questions: "" });

// A client whose check-in day is today (due), onboarded `daysAgo` days ago.
async function setup(daysAgo = 10, checkInWeekday = weekday(today)) {
  const coach = await createUser({ email: uniqueEmail("ci-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({
    email: uniqueEmail("ci-client"),
    name: "Klára",
    role: "CLIENT",
    timezone: "Europe/Prague",
    client: { create: { coachId: coach.id, checkInWeekday, onboardingCompletedAt: new Date(`${addDays(today, -daysAgo)}T10:00:00Z`) } },
  });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}

test("submitting the due check-in: answers stored, the coach told once, a second submit refused, the period waits for review", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(user.email);
  expect((await currentCheckIn(client, "Europe/Prague")).status).toBe("due");
  expect(await submitCheckIn(null, form({ ...answers(), energyComment: " Unavená ", questions: "Víc sacharidů?" }))).toBeNull();
  const [checkIn] = await db.checkIn.findMany({ where: { clientId: client.id } });
  expect(checkIn).toMatchObject({ dueDate: today, questions: "Víc sacharidů?", reviewedAt: null, answers: { energy: { score: 7, comment: "Unavená" }, mood: { score: 7, comment: null } } });
  expect(await db.notification.findMany({ where: { userId: coach.id } })).toMatchObject([{ type: "CHECK_IN_SUBMITTED", payload: { client: "Klára", checkInId: checkIn.id } }]);

  expect(await submitCheckIn(null, form(answers("3")))).toEqual({ already: true });
  expect(await db.checkIn.count({ where: { clientId: client.id } })).toBe(1);
  expect((await currentCheckIn(client, "Europe/Prague")).status).toBe("toReview");
});

test("no period before the first check-in day; invalid scores are refused", async () => {
  const { user, client } = await setup(0, weekday(addDays(today, 1))); // finished onboarding today, check-in day tomorrow
  request.cookie = await signIn(user.email);
  expect(await submitCheckIn(null, form(answers()))).toEqual({ already: true });
  await db.client.update({ where: { id: client.id }, data: { checkInWeekday: weekday(today) } });
  expect(await submitCheckIn(null, form({ ...answers(), energy: "0", hunger: "11", mood: "" }))).toEqual({ invalid: ["energy", "hunger", "mood"] });
  expect(await db.checkIn.count({ where: { clientId: client.id } })).toBe(0);
});

test("the 'check-in due' notification is created once per period, however often the app loads", async () => {
  const { user, client } = await setup();
  const period = await currentCheckIn(client, "Europe/Prague");
  await notifyCheckInDue(user.id, period);
  await notifyCheckInDue(user.id, period);
  expect(await db.notification.findMany({ where: { userId: user.id } })).toMatchObject([{ type: "CHECK_IN_DUE", key: today, payload: { dueDate: today } }]);
});

test("the coach sets the check-in weekday; statuses for the client list; another coach and the client can't set it", async () => {
  const { coach, user, client } = await setup(20, weekday(addDays(today, -3)));
  expect((await checkInStatuses([{ ...client, timezone: "Europe/Prague" }])).get(client.id)).toBe("overdue"); // 3 days after
  request.cookie = await signIn(coach.email);
  await setCheckInWeekday(form({ clientId: client.id, weekday: String(weekday(today)) }));
  const moved = await db.client.findUniqueOrThrow({ where: { id: client.id } });
  expect((await checkInStatuses([{ ...moved, timezone: "Europe/Prague" }])).get(client.id)).toBe("due");
  await expect(setCheckInWeekday(form({ clientId: client.id, weekday: "8" }))).rejects.toThrow();

  const other = await createUser({ email: uniqueEmail("ci-other"), name: "Other", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(setCheckInWeekday(form({ clientId: client.id, weekday: "3" }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(user.email);
  await expect(setCheckInWeekday(form({ clientId: client.id, weekday: "3" }))).rejects.toMatchObject(redirectsTo("/app"));
  expect(await db.client.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ checkInWeekday: weekday(today) });
});
