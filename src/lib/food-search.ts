import type { Food } from "@/generated/prisma/client";
import { db } from "./db";
import { type Serving, visibleFoods } from "./foods";
import { type OffFood, searchOff } from "./off";

// What the food search returns: a stored food (id) or an OFF product not used yet (offCode; stored on first use).
export type FoodResult = Pick<Food, "name" | "brand" | "kcal" | "protein" | "carbs" | "fat" | "source"> & { id: string | null; offCode: string | null; servings: Serving[] };
type Viewer = Parameters<typeof visibleFoods>[0];

export const fromFood = (food: Food): FoodResult => ({ ...food, servings: food.servings as Serving[] });
const fromOff = (food: OffFood): FoodResult => ({ ...food, id: null, source: "OFF" });

// Search (nutrition.md): the client's recently logged foods, then custom foods, then OFF products already stored, then
// Open Food Facts. When OFF fails or times out the local results still come back, with offUnavailable for the notice.
// ponytail: SQLite LIKE ignores case for ASCII only, so "syr" misses "sýr" locally (OFF still finds it); a folded name column if it matters.
export async function searchFoods(viewer: Viewer, query: string, locale: string, recent: string[] = []) {
  const local = await db.food.findMany({
    where: { AND: [visibleFoods(viewer), { OR: [{ name: { contains: query } }, { brand: { contains: query } }] }] },
    orderBy: { name: "asc" },
    take: 20,
  });
  const rank = (food: Food) => (recent.includes(food.id) ? recent.indexOf(food.id) : recent.length + (food.source === "OFF" ? 1 : 0));
  const ordered = local.sort((a, b) => rank(a) - rank(b)); // stable: by name within each group
  try {
    const known = new Set(local.map((f) => f.offCode));
    const off = (await searchOff(query, locale)).filter((f) => !known.has(f.offCode));
    return { results: [...ordered.map(fromFood), ...off.map(fromOff)], offUnavailable: false };
  } catch {
    return { results: ordered.map(fromFood), offUnavailable: true };
  }
}

// What a client logged lately, newest first (distinct foods): the search's first group and the list before typing.
export async function recentFoods(clientId: string) {
  const rows = await db.foodEntry.findMany({
    where: { clientId, foodId: { not: null } },
    orderBy: { createdAt: "desc" },
    distinct: ["foodId"],
    take: 20,
    include: { food: true },
  });
  return rows.flatMap((row) => (row.food ? [row.food] : []));
}
