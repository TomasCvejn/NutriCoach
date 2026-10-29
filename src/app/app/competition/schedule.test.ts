import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ordered } from "@/lib/schedule";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteScheduleItem, duplicateScheduleItem, moveScheduleItem, saveScheduleItem, shiftSchedule, tickScheduleItem } from "./schedule-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("sch-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("sch-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const client = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  const competition = await db.competition.create({ data: { clientId: client.id, name: "Maraton", date: "2026-11-08", priority: "A" } });
  return { coach, user, competition };
}
const item = (competitionId: string, time: string, title: string, type = "CARBS") => ({
  ...{ competitionId, time, type, title, details: "", carbs: "", fluid: "", sodium: "", caffeine: "", recipeId: "" },
});
const day = async (competitionId: string) => ordered(await db.scheduleItem.findMany({ where: { competitionId } })).map((i) => `${i.time} ${i.title}`);

test("the coach builds the day: add, edit, duplicate after the original, move among the same time, shift, delete", async () => {
  const { coach, competition } = await setup();
  request.cookie = await signIn(coach.email);
  for (const [time, title, type] of [
    ["06:00", "Breakfast", "MEAL"],
    ["09:00", "Start", "EVENT"],
    ["09:00", "Gel", "CARBS"],
  ]) {
    expect(await saveScheduleItem(form(item(competition.id, time, title, type)))).toBeNull();
  }
  const gel = await db.scheduleItem.findFirstOrThrow({ where: { title: "Gel", competitionId: competition.id } });
  expect(await saveScheduleItem(form({ ...item(competition.id, "08:45", "Gel", "CARBS"), id: gel.id, carbs: "25", caffeine: "75" }))).toBeNull();
  expect(await db.scheduleItem.findUniqueOrThrow({ where: { id: gel.id } })).toMatchObject({ time: "08:45", carbs: 25, caffeine: 75, fluid: null });

  await duplicateScheduleItem(form({ competitionId: competition.id, id: gel.id }));
  await saveScheduleItem(form({ ...item(competition.id, "08:45", "Water", "HYDRATION"), fluid: "200" }));
  expect(await day(competition.id)).toEqual(["06:00 Breakfast", "08:45 Gel", "08:45 Gel", "08:45 Water", "09:00 Start"]);
  const water = await db.scheduleItem.findFirstOrThrow({ where: { title: "Water", competitionId: competition.id } });
  await moveScheduleItem(form({ competitionId: competition.id, id: water.id, direction: "up" }));
  expect(await day(competition.id)).toEqual(["06:00 Breakfast", "08:45 Gel", "08:45 Water", "08:45 Gel", "09:00 Start"]);
  const start = await db.scheduleItem.findFirstOrThrow({ where: { title: "Start", competitionId: competition.id } });
  await expect(moveScheduleItem(form({ competitionId: competition.id, id: start.id, direction: "up" }))).rejects.toMatchObject(notFound); // another time

  expect(await shiftSchedule(null, form({ competitionId: competition.id, minutes: "15" }))).toBeNull();
  expect(await day(competition.id)).toEqual(["06:15 Breakfast", "09:00 Gel", "09:00 Water", "09:00 Gel", "09:15 Start"]);
  expect(await shiftSchedule(null, form({ competitionId: competition.id, minutes: "-400" }))).toEqual({ invalid: ["minutes"] }); // before 00:00
  expect(await day(competition.id)).toHaveLength(5);

  await deleteScheduleItem(form({ competitionId: competition.id, id: water.id }));
  expect(await day(competition.id)).toEqual(["06:15 Breakfast", "09:00 Gel", "09:00 Gel", "09:15 Start"]);
});

test("bad input, another coach's recipe, the client and another coach are refused", async () => {
  const { coach, user, competition } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveScheduleItem(form({ ...item(competition.id, "24:00", " ", "NAP"), carbs: "-1" }))).toEqual({ invalid: ["time", "type", "title", "carbs"] });
  const other = await setup();
  const foreign = await db.recipe.create({ data: { coachId: other.coach.id, name: "Theirs", status: "PUBLISHED" } });
  expect(await saveScheduleItem(form({ ...item(competition.id, "07:00", "Bowl", "MEAL"), recipeId: foreign.id }))).toEqual({ invalid: ["recipeId"] });

  request.cookie = await signIn(user.email);
  await expect(saveScheduleItem(form(item(competition.id, "07:00", "Mine")))).rejects.toMatchObject(redirectsTo("/app"));
  request.cookie = await signIn(other.coach.email);
  await expect(shiftSchedule(null, form({ competitionId: competition.id, minutes: "10" }))).rejects.toMatchObject(notFound);
  expect(await db.scheduleItem.count({ where: { competitionId: competition.id } })).toBe(0);
});

test("the client ticks an item off; another client can't", async () => {
  const { coach, user, competition } = await setup();
  request.cookie = await signIn(coach.email);
  await saveScheduleItem(form(item(competition.id, "09:00", "Start", "EVENT")));
  const start = await db.scheduleItem.findFirstOrThrow({ where: { competitionId: competition.id } });
  request.cookie = await signIn(user.email);
  await tickScheduleItem(form({ competitionId: competition.id, id: start.id, done: "true" }));
  expect(await db.scheduleItem.findUniqueOrThrow({ where: { id: start.id } })).toMatchObject({ done: true });
  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(tickScheduleItem(form({ competitionId: competition.id, id: start.id, done: "false" }))).rejects.toMatchObject(notFound);
  await expect(tickScheduleItem(form({ competitionId: other.competition.id, id: start.id, done: "false" }))).rejects.toMatchObject(notFound);
  expect(await db.scheduleItem.findUniqueOrThrow({ where: { id: start.id } })).toMatchObject({ done: true });
});
