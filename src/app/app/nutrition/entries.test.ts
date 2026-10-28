import { afterEach, expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recentFoods } from "@/lib/food-search";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { addFoodEntry, addQuickEntry, deleteEntry, updateEntry } from "./entry-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
afterEach(() => vi.restoreAllMocks());

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const day = { date: "2026-10-20", slot: "Snídaně" };

async function setup() {
  const coach = await createUser({ email: uniqueEmail("log-coach"), name: "Log Coach", role: "COACH" });
  const client = async () => {
    const user = await createUser({ email: uniqueEmail("log-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
    return { user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
  };
  const [a, b] = [await client(), await client()];
  const granola = await db.food.create({
    data: { source: "COACH", ownerId: coach.id, name: "Granola", kcal: 455, protein: 12, carbs: 58, fat: 19, fiber: 8, servings: [{ label: "1 hrst", grams: 40 }] },
  });
  request.cookie = await signIn(a.user.email);
  return { coach, a, b, granola };
}
const entriesOf = (clientId: string) => db.foodEntry.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });

test("logging by grams or by serving stores a snapshot; editing the food later never changes it", async () => {
  const { a, granola } = await setup();
  expect(await addFoodEntry(form({ ...day, foodId: granola.id, by: "grams", grams: "150" }))).toBeNull();
  expect(await addFoodEntry(form({ ...day, slot: "Svačina", foodId: granola.id, by: "serving", serving: "0", count: "2" }))).toBeNull();
  await db.food.update({ where: { id: granola.id }, data: { name: "Granola nová", kcal: 500, protein: 20 } });
  expect(await entriesOf(a.client.id)).toMatchObject([
    { slot: "Snídaně", name: "Granola", grams: 150, servingLabel: null, kcal: 682.5, protein: 18, carbs: 87, fat: 28.5, fiber: 12, iron: null },
    { slot: "Svačina", name: "Granola", grams: 80, servingLabel: "1 hrst", servingCount: 2, kcal: 364, protein: 9.6 },
  ]);
  expect((await recentFoods(a.client.id)).map((f) => f.id)).toEqual([granola.id]);
});

test("edits: a new amount rescales the entry's own numbers, a move changes the meal, quick adds change their numbers; delete", async () => {
  const { a, granola } = await setup();
  await addFoodEntry(form({ ...day, foodId: granola.id, by: "grams", grams: "100" }));
  await addFoodEntry(form({ ...day, foodId: granola.id, by: "serving", serving: "0", count: "1" }));
  expect(await addQuickEntry(form({ ...day, name: "", kcal: "650", protein: "35", carbs: "", fat: "20" }))).toBeNull();
  await db.food.update({ where: { id: granola.id }, data: { kcal: 999 } }); // must not leak into the rescale
  const [byGrams, byServing, quick] = await entriesOf(a.client.id);
  expect(quick).toMatchObject({ name: null, grams: null, kcal: 650, protein: 35, carbs: 0, fat: 20 });

  expect(await updateEntry(form({ id: byGrams.id, slot: "Oběd", grams: "50" }))).toBeNull();
  expect(await updateEntry(form({ id: byServing.id, slot: "Snídaně", count: "3" }))).toBeNull();
  expect(await updateEntry(form({ id: quick.id, slot: "Snídaně", name: "Oběd v práci", kcal: "700", protein: "40", carbs: "80", fat: "22" }))).toBeNull();
  expect(await entriesOf(a.client.id)).toMatchObject([
    { slot: "Oběd", grams: 50, kcal: 227.5, protein: 6, fiber: 4 },
    { grams: 120, servingCount: 3, kcal: 546 },
    { name: "Oběd v práci", kcal: 700, carbs: 80 },
  ]);
  expect(await updateEntry(form({ id: byGrams.id, slot: " ", grams: "50" }))).toEqual({ invalid: ["slot"] });
  expect(await updateEntry(form({ id: byGrams.id, slot: "Oběd", grams: "0" }))).toEqual({ invalid: ["grams"] });
  await deleteEntry(form({ id: quick.id }));
  expect((await entriesOf(a.client.id)).length).toBe(2);
});

test("invalid amounts and unknown servings are refused and write nothing", async () => {
  const { a, granola } = await setup();
  expect(await addFoodEntry(form({ ...day, foodId: granola.id, by: "grams", grams: "-1" }))).toEqual({ invalid: ["grams"] });
  expect(await addFoodEntry(form({ ...day, foodId: granola.id, by: "serving", serving: "5", count: "1" }))).toEqual({ invalid: ["serving"] });
  expect(await addFoodEntry(form({ date: "2026-13-01", slot: "", foodId: granola.id, by: "grams", grams: "10" }))).toEqual({ invalid: ["date", "slot"] });
  expect(await addQuickEntry(form({ ...day, name: "", kcal: "", protein: "", carbs: "", fat: "" }))).toEqual({ invalid: ["kcal"] });
  expect(await entriesOf(a.client.id)).toEqual([]);
});

test("an OFF product is looked up and stored on the server on first use; when OFF is down nothing is logged", async () => {
  const { a } = await setup();
  const code = "8594009990101";
  const product = { code, product_name: "Kefír", nutriments: { "energy-kcal_100g": 60, proteins_100g: 3.3, carbohydrates_100g: 4.5, fat_100g: 3 } };
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timed out", "TimeoutError"));
  expect(await addFoodEntry(form({ ...day, offCode: code, by: "grams", grams: "250" }))).toEqual({ offUnavailable: true });
  expect(await entriesOf(a.client.id)).toEqual([]);

  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: 1, product }));
  fetch.mockClear(); // the same spy as above: count from here
  expect(await addFoodEntry(form({ ...day, offCode: code, by: "grams", grams: "250", kcal: "1" }))).toBeNull(); // sent nutrients are ignored
  expect(await addFoodEntry(form({ ...day, offCode: code, by: "grams", grams: "100" }))).toBeNull();
  expect(fetch).toHaveBeenCalledOnce(); // the second use finds the stored food
  expect(await entriesOf(a.client.id)).toMatchObject([{ name: "Kefír", kcal: 150, protein: 8.25 }, { kcal: 60 }]);
  expect(await db.food.count({ where: { offCode: code } })).toBe(1);
});

test("a client can't log another coach's food or touch another client's log; a coach can't write a client's log", async () => {
  const { coach, a, b } = await setup();
  const otherCoach = await createUser({ email: uniqueEmail("log-other"), name: "Other", role: "COACH" });
  const foreign = await db.food.create({ data: { source: "COACH", ownerId: otherCoach.id, name: "Cizí", kcal: 100, protein: 1, carbs: 1, fat: 1 } });
  const bFood = await db.food.create({ data: { source: "CLIENT", ownerId: b.user.id, name: "Bářino", kcal: 100, protein: 1, carbs: 1, fat: 1 } });
  await expect(addFoodEntry(form({ ...day, foodId: foreign.id, by: "grams", grams: "10" }))).rejects.toMatchObject(notFound);
  await expect(addFoodEntry(form({ ...day, foodId: bFood.id, by: "grams", grams: "10" }))).rejects.toMatchObject(notFound);

  request.cookie = await signIn(b.user.email);
  await addQuickEntry(form({ ...day, name: "", kcal: "300", protein: "", carbs: "", fat: "" }));
  const [bEntry] = await entriesOf(b.client.id);
  request.cookie = await signIn(a.user.email);
  await expect(updateEntry(form({ id: bEntry.id, slot: "Oběd", kcal: "1", protein: "", carbs: "", fat: "", name: "" }))).rejects.toMatchObject(notFound);
  await expect(deleteEntry(form({ id: bEntry.id }))).rejects.toMatchObject(notFound);

  request.cookie = await signIn(coach.email);
  await expect(addQuickEntry(form({ ...day, name: "", kcal: "300", protein: "", carbs: "", fat: "" }))).rejects.toMatchObject(redirectsTo("/coach"));
  await expect(deleteEntry(form({ id: bEntry.id }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await entriesOf(b.client.id)).toMatchObject([{ kcal: 300 }]);
  expect(await entriesOf(a.client.id)).toEqual([]);
});
