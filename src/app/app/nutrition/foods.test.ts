import { expect, test, vi } from "vitest";
import LibraryFoods from "@/app/coach/library/page";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MICRONUTRIENTS } from "@/lib/enums";
import { visibleFoods } from "@/lib/foods";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteFood, saveFood } from "./food-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
// What the food form sends: every field, the folded micronutrients included.
const food = (fields: Record<string, string | string[]> = {}) =>
  form({
    ...{ name: "Skyr", brand: "", kcal: "63", protein: "11", carbs: "4", fat: "0.2" },
    ...Object.fromEntries(Object.keys(MICRONUTRIENTS).map((m) => [m, ""])),
    ...{ sodium: "40", servingLabel: [], servingGrams: [] },
    ...fields,
  });

async function people() {
  const coach = (name: string) => createUser({ email: uniqueEmail("foods-coach"), name, role: "COACH" });
  const [a, b] = [await coach("Coach A"), await coach("Coach B")];
  const client = async (coachId: string) => {
    const user = await createUser({ email: uniqueEmail("foods-client"), name: "Client", role: "CLIENT", client: { create: { coachId } } });
    return { ...user, coachId };
  };
  return { a, b, a1: await client(a.id), a2: await client(a.id), b1: await client(b.id) };
}

test("who sees which food: coach foods only that coach's clients, client foods only the client and their coach", async () => {
  const { a, b, a1, a2, b1 } = await people();
  const make = (name: string, source: string, ownerId: string | null) => db.food.create({ data: { name, source, ownerId, kcal: 100, protein: 1, carbs: 1, fat: 1 } });
  const foods = [await make("off", "OFF", null), await make("fa", "COACH", a.id), await make("fb", "COACH", b.id), await make("fa1", "CLIENT", a1.id), await make("fa2", "CLIENT", a2.id)];
  const ids = foods.map((f) => f.id);
  const seen = async (viewer: Parameters<typeof visibleFoods>[0]) =>
    (await db.food.findMany({ where: { AND: [visibleFoods(viewer), { id: { in: ids } }] } })).map((f) => f.name).sort();
  expect(await seen({ role: "CLIENT", id: a1.id, coachId: a.id })).toEqual(["fa", "fa1", "off"]);
  expect(await seen({ role: "CLIENT", id: a2.id, coachId: a.id })).toEqual(["fa", "fa2", "off"]);
  expect(await seen({ role: "CLIENT", id: b1.id, coachId: b.id })).toEqual(["fb", "off"]);
  expect(await seen({ role: "COACH", id: a.id })).toEqual(["fa", "fa1", "fa2", "off"]);
  expect(await seen({ role: "COACH", id: b.id })).toEqual(["fb", "off"]);
});

test("coach and client make their own foods with servings; invalid input writes nothing", async () => {
  const { a, a1 } = await people();
  request.cookie = await signIn(a.email);
  expect(await saveFood(food({ name: " Granola ", servingLabel: ["1 hrst", ""], servingGrams: ["40", ""] }))).toBeNull();
  expect(await db.food.findFirstOrThrow({ where: { ownerId: a.id } })).toMatchObject({ source: "COACH", name: "Granola", brand: null, fiber: null, sodium: 40, servings: [{ label: "1 hrst", grams: 40 }] });

  request.cookie = await signIn(a1.email);
  expect(await saveFood(food())).toBeNull();
  expect(await db.food.findFirstOrThrow({ where: { ownerId: a1.id } })).toMatchObject({ source: "CLIENT", name: "Skyr", kcal: 63, fat: 0.2 });

  const bad = food({ name: " ", kcal: "-1", protein: "120", sodium: "x", servingLabel: ["kus"], servingGrams: [""] });
  expect(await saveFood(bad)).toEqual({ invalid: ["name", "kcal", "protein", "sodium", "servings"] });
  expect(await db.food.count({ where: { ownerId: a1.id } })).toBe(1);
});

test("only the owner edits or deletes a food; the library is the coach's", async () => {
  const { a, b, a1 } = await people();
  const coachFood = await db.food.create({ data: { name: "fa", source: "COACH", ownerId: a.id, kcal: 100, protein: 1, carbs: 1, fat: 1 } });
  const clientFood = await db.food.create({ data: { name: "fa1", source: "CLIENT", ownerId: a1.id, kcal: 100, protein: 1, carbs: 1, fat: 1 } });

  request.cookie = await signIn(a1.email); // a client can't change their coach's food
  await expect(saveFood(food({ id: coachFood.id }))).rejects.toMatchObject(notFound);
  await expect(deleteFood(form({ id: coachFood.id }))).rejects.toMatchObject(notFound);
  await expect(LibraryFoods()).rejects.toMatchObject(redirectsTo("/app"));
  expect(await saveFood(food({ id: clientFood.id, name: "Skyr bez laktózy" }))).toBeNull();

  request.cookie = await signIn(a.email); // the coach sees the client's food but doesn't edit it
  await expect(saveFood(food({ id: clientFood.id }))).rejects.toMatchObject(notFound);
  await expect(deleteFood(form({ id: clientFood.id }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(b.email);
  await expect(saveFood(food({ id: coachFood.id }))).rejects.toMatchObject(notFound);

  request.cookie = await signIn(a.email);
  await deleteFood(form({ id: coachFood.id }));
  expect(await db.food.findMany({ where: { id: { in: [coachFood.id, clientFood.id] } } })).toMatchObject([{ name: "Skyr bez laktózy" }]);
});
