import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import ClientPlan from "@/app/app/plan/page";
import { copyPlan, deleteMeal, deleteRecommendation, reorderPlan, saveMeal, saveRecommendation, saveSpecifics } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
const meal = (clientId: string, fields: Record<string, string>) => form({ clientId, timeHint: "", guidance: "", note: "", ...fields });

async function setup() {
  const coach = await createUser({ email: uniqueEmail("plan-coach"), name: "Plan Coach", role: "COACH" });
  const client = async (name: string, trackingMode = "CALORIES") => {
    const user = await createUser({ email: uniqueEmail("plan-client"), name, role: "CLIENT", client: { create: { coachId: coach.id, trackingMode } } });
    return { user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
  };
  const [anna, bara] = await Promise.all([client("Anna", "PORTIONS"), client("Bára")]);
  request.cookie = await signIn(coach.email);
  return { coach, anna, bara };
}
const mealsOf = (clientId: string) => db.planMeal.findMany({ where: { clientId }, orderBy: [{ dayType: "asc" }, { position: "asc" }] });
const planEvents = (clientId: string) => db.historyEvent.findMany({ where: { clientId, type: "PLAN" }, orderBy: { createdAt: "asc" } });
const notified = (userId: string) => db.notification.count({ where: { userId, type: "PLAN_UPDATED" } });

test("meals: add at the end of their day type, edit (moving to another day type goes last), reorder, delete; each change is history + one notification", async () => {
  const { anna } = await setup();
  const { client, user } = anna;
  expect(await saveMeal(meal(client.id, { dayType: "REST", name: "Snídaně", palms: "1", hands: "0.5" }))).toBeNull();
  expect(await saveMeal(meal(client.id, { dayType: "REST", name: " Oběd ", timeHint: "12:00" }))).toBeNull();
  expect(await saveMeal(meal(client.id, { dayType: "TRAINING", name: "Před tréninkem" }))).toBeNull();
  const byName = async (name: string) => (await mealsOf(client.id)).find((m) => m.name === name)!;
  let breakfast = await byName("Snídaně");
  const [lunch, pre] = [await byName("Oběd"), await byName("Před tréninkem")];
  expect([breakfast, lunch, pre]).toMatchObject([
    { dayType: "REST", position: 0, name: "Snídaně", palms: 1, hands: 0.5, timeHint: null },
    { dayType: "REST", position: 1, name: "Oběd", timeHint: "12:00" },
    { dayType: "TRAINING", position: 0 },
  ]);

  // Without portion fields (another mode's form) the stored counts stay.
  expect(await saveMeal(meal(client.id, { id: breakfast.id, dayType: "TRAINING", name: "Snídaně" }))).toBeNull();
  breakfast = await db.planMeal.findUniqueOrThrow({ where: { id: breakfast.id } });
  expect(breakfast).toMatchObject({ dayType: "TRAINING", position: 1, palms: 1, hands: 0.5 });

  await reorderPlan(form({ clientId: client.id, kind: "meals", dayType: "TRAINING", ids: [breakfast.id, pre.id] }));
  expect((await mealsOf(client.id)).filter((m) => m.dayType === "TRAINING").map((m) => m.name)).toEqual(["Snídaně", "Před tréninkem"]);
  await deleteMeal(form({ clientId: client.id, id: lunch.id }));

  expect((await planEvents(client.id)).map((e) => e.payload)).toEqual([
    ...[{ change: "MEALS", dayType: "REST" }, { change: "MEALS", dayType: "REST" }, { change: "MEALS", dayType: "TRAINING" }],
    ...[{ change: "MEALS", dayType: "TRAINING" }, { change: "MEALS", dayType: "TRAINING" }, { change: "MEALS", dayType: "REST" }],
  ]);
  expect((await planEvents(client.id))[0].date).toBe(todayIn("Europe/Prague"));
  expect(await notified(user.id)).toBe(6);

  expect(await saveMeal(meal(client.id, { dayType: "SNACK", name: " ", palms: "0.3" }))).toEqual({ invalid: ["dayType", "name", "palms"] });
  expect((await mealsOf(client.id)).length).toBe(2);
  expect(await notified(user.id)).toBe(6);
});

test("a reorder must name exactly the items that are there", async () => {
  const { anna, bara } = await setup();
  for (const name of ["A", "B"]) await saveMeal(meal(anna.client.id, { dayType: "REST", name }));
  await saveMeal(meal(bara.client.id, { dayType: "REST", name: "C" }));
  const [a, b] = await mealsOf(anna.client.id);
  const [c] = await mealsOf(bara.client.id);
  const reorder = (ids: string[]) => reorderPlan(form({ clientId: anna.client.id, kind: "meals", dayType: "REST", ids }));
  for (const ids of [[a.id], [a.id, a.id], [a.id, c.id], [a.id, b.id, c.id]]) await expect(reorder(ids)).rejects.toMatchObject(notFound);
  expect((await mealsOf(anna.client.id)).map((m) => m.name)).toEqual(["A", "B"]);
});

test("recommendations and specifics; saving unchanged specifics notifies nobody", async () => {
  const { bara } = await setup();
  const { client, user } = bara;
  expect(await saveRecommendation(form({ clientId: client.id, title: "Bílkoviny v každém jídle", text: "" }))).toBeNull();
  expect(await saveRecommendation(form({ clientId: client.id, title: "Pitný režim", text: "2 l denně" }))).toBeNull();
  const [first, second] = await db.planRecommendation.findMany({ where: { clientId: client.id }, orderBy: { position: "asc" } });
  expect([first, second]).toMatchObject([{ position: 0, text: null }, { position: 1, text: "2 l denně" }]);
  await reorderPlan(form({ clientId: client.id, kind: "recommendations", ids: [second.id, first.id] }));
  expect(await saveRecommendation(form({ clientId: client.id, id: first.id, title: "Bílkoviny vždy", text: "" }))).toBeNull();
  await deleteRecommendation(form({ clientId: client.id, id: second.id }));
  expect(await db.planRecommendation.findMany({ where: { clientId: client.id } })).toMatchObject([{ title: "Bílkoviny vždy", position: 1 }]);
  expect(await saveRecommendation(form({ clientId: client.id, title: "x".repeat(151), text: "" }))).toEqual({ invalid: ["title"] });

  expect(await saveSpecifics(null, form({ clientId: client.id, planSpecifics: " Směny " }))).toEqual({ saved: true });
  expect(await saveSpecifics(null, form({ clientId: client.id, planSpecifics: "Směny" }))).toEqual({ saved: true });
  expect(await db.client.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ planSpecifics: "Směny" });
  expect((await planEvents(client.id)).map((e) => (e.payload as { change: string }).change)).toEqual(["RECOMMENDATIONS", "RECOMMENDATIONS", "RECOMMENDATIONS", "RECOMMENDATIONS", "RECOMMENDATIONS", "SPECIFICS"]);
  expect(await notified(user.id)).toBe(6);
});

test("copying a plan: the source's targets from today, its meals and recommendations replace these, specifics stay; the copy is independent", async () => {
  const { anna, bara } = await setup();
  const source = anna.client;
  await db.nutritionTarget.create({ data: { clientId: source.id, dayType: "REST", effectiveFrom: "2026-01-01", kcal: 2000, palms: 5, fluidMl: 2500 } });
  await saveMeal(meal(source.id, { dayType: "REST", name: "Snídaně", palms: "1" }));
  await saveRecommendation(form({ clientId: source.id, title: "Bílkoviny", text: "" }));
  await saveMeal(meal(bara.client.id, { dayType: "REST", name: "Stará večeře" }));
  await saveSpecifics(null, form({ clientId: bara.client.id, planSpecifics: "Jen Bára" }));

  await copyPlan(form({ clientId: bara.client.id, sourceId: source.id }));
  const today = todayIn("Europe/Prague");
  expect(await db.nutritionTarget.findMany({ where: { clientId: bara.client.id } })).toMatchObject([{ dayType: "REST", effectiveFrom: today, kcal: 2000, palms: 5, fluidMl: 2500 }]);
  expect(await mealsOf(bara.client.id)).toMatchObject([{ name: "Snídaně", palms: 1, position: 0 }]);
  expect(await db.planRecommendation.findMany({ where: { clientId: bara.client.id } })).toMatchObject([{ title: "Bílkoviny" }]);
  expect(await db.client.findUniqueOrThrow({ where: { id: bara.client.id } })).toMatchObject({ planSpecifics: "Jen Bára" });
  expect((await planEvents(bara.client.id)).at(-1)?.payload).toEqual({ change: "COPY", source: "Anna" });

  // Editing or deleting the source afterwards leaves the copy alone.
  const [sourceMeal] = await mealsOf(source.id);
  await saveMeal(meal(source.id, { id: sourceMeal.id, dayType: "REST", name: "Jiná snídaně" }));
  await db.nutritionTarget.updateMany({ where: { clientId: source.id }, data: { kcal: 1500 } });
  await db.planRecommendation.deleteMany({ where: { clientId: source.id } });
  expect(await mealsOf(bara.client.id)).toMatchObject([{ name: "Snídaně" }]);
  expect(await db.nutritionTarget.findFirstOrThrow({ where: { clientId: bara.client.id } })).toMatchObject({ kcal: 2000 });
  expect(await db.planRecommendation.count({ where: { clientId: bara.client.id } })).toBe(1);
});

test("another coach's client can't be copied from or edited, a client can't touch the plan, and a plan isn't copied onto itself", async () => {
  const { anna, bara } = await setup();
  const other = await setup(); // signs in as the other coach
  await expect(copyPlan(form({ clientId: other.bara.client.id, sourceId: anna.client.id }))).rejects.toMatchObject(notFound);
  await expect(copyPlan(form({ clientId: anna.client.id, sourceId: other.bara.client.id }))).rejects.toMatchObject(notFound);
  await expect(copyPlan(form({ clientId: other.anna.client.id, sourceId: other.anna.client.id }))).rejects.toMatchObject(notFound);
  await expect(saveMeal(meal(anna.client.id, { dayType: "REST", name: "X" }))).rejects.toMatchObject(notFound);
  await expect(saveSpecifics(null, form({ clientId: anna.client.id, planSpecifics: "X" }))).rejects.toMatchObject(notFound);

  request.cookie = await signIn(bara.user.email);
  await expect(saveRecommendation(form({ clientId: bara.client.id, title: "X", text: "" }))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(copyPlan(form({ clientId: bara.client.id, sourceId: anna.client.id }))).rejects.toMatchObject(redirectsTo("/app"));
  expect(await mealsOf(anna.client.id)).toEqual([]);
  expect(await db.planRecommendation.count({ where: { clientId: bara.client.id } })).toBe(0);
});

test("the client plan page is the signed-in client's own: a coach or nobody is sent away", async () => {
  await setup();
  const searchParams = Promise.resolve({});
  await expect(ClientPlan({ params: Promise.resolve({}), searchParams })).rejects.toMatchObject(redirectsTo("/coach"));
  request.cookie = "";
  await expect(ClientPlan({ params: Promise.resolve({}), searchParams })).rejects.toMatchObject(redirectsTo("/login"));
});
