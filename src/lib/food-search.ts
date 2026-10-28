import type { Food } from "@/generated/prisma/client";
import { db } from "./db";
import { type Serving, visibleFoods } from "./foods";
import { type OffFood, offProduct, searchOff } from "./off";

// What the food search returns: a stored food (id) or an OFF product not used yet (offCode; stored on first use).
export type FoodResult = Pick<Food, "name" | "brand" | "kcal" | "protein" | "carbs" | "fat" | "source"> & { id: string | null; offCode: string | null; servings: Serving[] };
type Viewer = Parameters<typeof visibleFoods>[0];

const fromFood = (food: Food): FoodResult => ({ ...food, servings: food.servings as Serving[] });
const fromOff = (food: OffFood): FoodResult => ({ ...food, id: null, source: "OFF" });

// Search (nutrition.md): the viewer's custom foods, then OFF products already stored, then Open Food Facts. When OFF
// fails or times out the local results still come back, with offUnavailable for the notice.
// ponytail: no food log yet; the CALORIES day item puts the client's recently logged foods first.
// ponytail: SQLite LIKE ignores case for ASCII only, so "syr" misses "sýr" locally (OFF still finds it); a folded name column if it matters.
export async function searchFoods(viewer: Viewer, query: string, locale: string) {
  const local = await db.food.findMany({
    where: { AND: [visibleFoods(viewer), { OR: [{ name: { contains: query } }, { brand: { contains: query } }] }] },
    orderBy: { name: "asc" },
    take: 20,
  });
  const ordered = [...local.filter((f) => f.source !== "OFF"), ...local.filter((f) => f.source === "OFF")];
  try {
    const known = new Set(local.map((f) => f.offCode));
    const off = (await searchOff(query, locale)).filter((f) => !known.has(f.offCode));
    return { results: [...ordered.map(fromFood), ...off.map(fromOff)], offUnavailable: false };
  } catch {
    return { results: ordered.map(fromFood), offUnavailable: true };
  }
}

// A scanned or typed EAN: a food the viewer has with that barcode, else the OFF product.
export async function findByBarcode(viewer: Viewer, ean: string, locale: string) {
  const local = await db.food.findFirst({ where: { AND: [visibleFoods(viewer), { barcode: ean }] }, orderBy: { source: "asc" } });
  if (local) return { results: [fromFood(local)], offUnavailable: false };
  try {
    const off = await offProduct(ean, locale);
    return { results: off ? [fromOff(off)] : [], offUnavailable: false };
  } catch {
    return { results: [], offUnavailable: true };
  }
}
