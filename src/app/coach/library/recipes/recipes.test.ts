import { afterEach, expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import EditRecipe from "./[id]/page";
import { duplicateRecipe, saveRecipe, setRecipeStatus } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
afterEach(() => vi.restoreAllMocks());

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
const recipe = (fields: Record<string, string | string[] | object[]> = {}) => {
  const { ingredients = [], steps = ["Smíchat."], substitutions = [], ...rest } = fields as Record<string, unknown>;
  return form({
    ...{ status: "DRAFT", name: "Kaše", categories: ["BREAKFAST"], prepMinutes: "10", servings: "2", dietFlags: [], allergens: ["GLUTEN"] }, // what the form sends
    ...(rest as Record<string, string | string[]>),
    ...{ ingredients: JSON.stringify(ingredients), steps: JSON.stringify(steps), substitutions: JSON.stringify(substitutions) },
  });
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("recipe-coach"), name: "Recipe Coach", role: "COACH" });
  const client = await createUser({ email: uniqueEmail("recipe-client"), name: "Client", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const make = (source: string, ownerId: string) => db.food.create({ data: { source, ownerId, name: `${source} food`, kcal: 100, protein: 10, carbs: 10, fat: 1 } });
  const [own, clientFood] = [await make("COACH", coach.id), await make("CLIENT", client.id)];
  request.cookie = await signIn(coach.email);
  return { coach, client, own, clientFood };
}

test("a coach saves a recipe: own foods, an OFF product stored on the server, free text; it lands in the list", async () => {
  const { coach, own } = await setup();
  const code = "8594009990201";
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: 1, product: { code, product_name: "Ovesné vločky OFF", nutriments: { "energy-kcal_100g": 370, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 } } }));
  const ingredients = [{ foodId: own.id, name: "Moje potravina", grams: 80 }, { offCode: code, name: "Vločky", grams: 50 }, { name: "Špetka soli", grams: 2 }];
  await expect(saveRecipe(null, recipe({ ingredients, substitutions: [{ instead: "Banán", use: "Jablko", note: "" }] }))).rejects.toMatchObject(redirectsTo("/coach/library/recipes"));
  expect(fetch).toHaveBeenCalledOnce();
  const saved = await db.recipe.findFirstOrThrow({ where: { coachId: coach.id } });
  const off = await db.food.findUniqueOrThrow({ where: { offCode: code } });
  expect(saved).toMatchObject({
    ...{ name: "Kaše", status: "DRAFT", categories: ["BREAKFAST"], prepMinutes: 10, servings: 2, dietFlags: [], allergens: ["GLUTEN"], steps: ["Smíchat."] },
    ingredients: [{ foodId: own.id, name: "Moje potravina", grams: 80 }, { foodId: off.id, name: "Vločky", grams: 50 }, { name: "Špetka soli" }],
    substitutions: [{ instead: "Banán", use: "Jablko", note: null }],
  });

  await expect(saveRecipe(null, recipe({ id: saved.id, name: "Kaše s banánem", status: "PUBLISHED" }))).rejects.toMatchObject(redirectsTo("/coach/library/recipes"));
  expect(await db.recipe.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ name: "Kaše s banánem", status: "PUBLISHED", ingredients: [] });
});

test("a client's food or another coach's food can't be an ingredient; invalid input is refused", async () => {
  const { coach, clientFood } = await setup();
  const other = await createUser({ email: uniqueEmail("recipe-other"), name: "Other", role: "COACH" });
  const foreign = await db.food.create({ data: { source: "COACH", ownerId: other.id, name: "Cizí", kcal: 1, protein: 1, carbs: 1, fat: 1 } });
  for (const foodId of [clientFood.id, foreign.id]) expect(await saveRecipe(null, recipe({ ingredients: [{ foodId, name: "X", grams: 10 }] }))).toEqual({ invalid: ["ingredients"] });
  expect(await saveRecipe(null, recipe({ name: " ", servings: "0", categories: ["BRUNCH"], steps: [""] }))).toEqual({ invalid: ["name", "categories", "servings", "steps"] });
  expect(await saveRecipe(null, form({ status: "DRAFT", name: "X", prepMinutes: "", servings: "1", ingredients: "{oops", steps: "[]", substitutions: "[]" }))).toEqual({ invalid: ["ingredients"] });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timed out", "TimeoutError"));
  expect(await saveRecipe(null, recipe({ ingredients: [{ offCode: "8594009990299", name: "X", grams: 10 }] }))).toEqual({ offUnavailable: true });
  expect(await db.recipe.count({ where: { coachId: coach.id } })).toBe(0);
});

test("duplicate makes a draft copy; archive and restore; another coach and a client are refused", async () => {
  const { coach, client } = await setup();
  const original = await db.recipe.create({ data: { coachId: coach.id, name: "Bowl", status: "PUBLISHED", servings: 2, steps: ["Uvařit."], categories: ["LUNCH"] } });
  await expect(duplicateRecipe(form({ id: original.id }))).rejects.toMatchObject({ digest: expect.stringContaining(";/coach/library/recipes/") });
  expect(await db.recipe.findMany({ where: { coachId: coach.id }, orderBy: { createdAt: "asc" } })).toMatchObject([
    { name: "Bowl", status: "PUBLISHED" },
    { name: "Bowl (kopie)", status: "DRAFT", steps: ["Uvařit."], categories: ["LUNCH"], servings: 2 },
  ]);
  await setRecipeStatus(form({ id: original.id, status: "ARCHIVED" }));
  expect(await db.recipe.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ status: "ARCHIVED" });
  await setRecipeStatus(form({ id: original.id, status: "DRAFT" }));

  const other = await createUser({ email: uniqueEmail("recipe-other"), name: "Other", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(saveRecipe(null, recipe({ id: original.id }))).rejects.toMatchObject(notFound);
  await expect(duplicateRecipe(form({ id: original.id }))).rejects.toMatchObject(notFound);
  await expect(setRecipeStatus(form({ id: original.id, status: "ARCHIVED" }))).rejects.toMatchObject(notFound);
  await expect(EditRecipe({ params: Promise.resolve({ id: original.id }), searchParams: Promise.resolve({}) })).rejects.toMatchObject(notFound);
  request.cookie = await signIn(client.email);
  await expect(saveRecipe(null, recipe())).rejects.toMatchObject(redirectsTo("/app"));
  expect(await db.recipe.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ name: "Bowl", status: "DRAFT" });
});
