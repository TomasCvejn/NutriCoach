import { expect, test, vi } from "vitest";
import { saveMeal } from "@/app/coach/clients/[id]/nutrition/actions";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { logRecipe, updateEntry } from "../nutrition/entry-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("rlog-coach"), name: "Coach", role: "COACH" });
  const other = await createUser({ email: uniqueEmail("rlog-other"), name: "Other", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("rlog-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const oats = await db.food.create({ data: { source: "COACH", ownerId: coach.id, name: "Vločky", kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 } });
  const recipe = (coachId: string, status = "PUBLISHED") =>
    db.recipe.create({ data: { coachId, name: "Kaše", status, servings: 2, ingredients: [{ foodId: oats.id, name: "Vločky", grams: 100 }, { name: "Skořice" }] } });
  const [published, draft, foreign] = [await recipe(coach.id), await recipe(coach.id, "DRAFT"), await recipe(other.id)];
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }), oats, published, draft, foreign };
}
const at = { date: "2026-10-20", slot: "Snídaně" };

test("logging a recipe stores its portions as a snapshot; editing the recipe or its foods later changes nothing", async () => {
  const { user, client, oats, published } = await setup();
  request.cookie = await signIn(user.email);
  expect(await logRecipe(form({ ...at, recipeId: published.id, portions: "2" }))).toBeNull();
  const [entry] = await db.foodEntry.findMany({ where: { clientId: client.id } });
  // Per portion: 100 g oats / 2 = 185 kcal; 2 portions = 370 kcal (the text ingredient adds nothing).
  expect(entry).toMatchObject({ name: "Kaše", servingLabel: "porce", servingCount: 2, grams: null, foodId: null, kcal: 370, protein: 13, fiber: 10 });

  await db.recipe.update({ where: { id: published.id }, data: { name: "Kaše nová", ingredients: [{ foodId: oats.id, name: "Vločky", grams: 300 }] } });
  await db.food.update({ where: { id: oats.id }, data: { kcal: 999 } });
  expect(await db.foodEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({ name: "Kaše", kcal: 370 });

  expect(await updateEntry(form({ id: entry.id, slot: "Oběd", count: "3" }))).toBeNull(); // the count scales the snapshot
  expect(await db.foodEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({ slot: "Oběd", servingCount: 3, grams: null, kcal: 555, protein: 19.5 });
});

test("only the client's coach's published recipes can be logged; a coach can't log; bad portions are refused", async () => {
  const { coach, user, client, published, draft, foreign } = await setup();
  request.cookie = await signIn(user.email);
  for (const r of [draft, foreign]) await expect(logRecipe(form({ ...at, recipeId: r.id, portions: "1" }))).rejects.toMatchObject(notFound);
  expect(await logRecipe(form({ ...at, recipeId: published.id, portions: "0" }))).toEqual({ invalid: ["portions"] });
  request.cookie = await signIn(coach.email);
  await expect(logRecipe(form({ ...at, recipeId: published.id, portions: "1" }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await db.foodEntry.count({ where: { clientId: client.id } })).toBe(0);
});

test("a plan meal offers only the coach's own recipes", async () => {
  const { coach, client, published, foreign } = await setup();
  request.cookie = await signIn(coach.email);
  const meal = { clientId: client.id, dayType: "REST", name: "Snídaně", timeHint: "", guidance: "", note: "" };
  expect(await saveMeal(form({ ...meal, recipeIds: [published.id, published.id] }))).toBeNull();
  expect(await db.planMeal.findFirstOrThrow({ where: { clientId: client.id } })).toMatchObject({ recipeIds: [published.id] });
  expect(await saveMeal(form({ ...meal, recipeIds: [foreign.id] }))).toEqual({ invalid: ["recipeIds"] });
});
