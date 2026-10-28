import { z } from "zod";
import { db } from "./db";
import type { Serving } from "./foods";

// Open Food Facts (nutrition.md), always from the server: our User-Agent, a 5 s timeout. OFF_BASE_URL only exists so e2e
// can point it at an unreachable host.
const base = () => process.env.OFF_BASE_URL ?? "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_cs,product_name_en,brands,nutriments,countries_tags,serving_size,serving_quantity";

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, { headers: { "User-Agent": "NutriCoach/0.1" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  return res.json();
}

type Nutrients = Record<(typeof NUTRIENTS)[number][0], number | null> & { kcal: number; protein: number; carbs: number; fat: number };
export type OffFood = Nutrients & {
  offCode: string;
  name: string;
  brand: string | null;
  czech: boolean; // sold in the Czech Republic, listed first
  servings: Serving[];
};

// Our field ← OFF's per-100 g nutriment and the factor to our unit (OFF gives sodium in grams).
const NUTRIENTS = [
  ["kcal", "energy-kcal_100g", 1],
  ["protein", "proteins_100g", 1],
  ["carbs", "carbohydrates_100g", 1],
  ["fat", "fat_100g", 1],
  ["fiber", "fiber_100g", 1],
  ["sodium", "sodium_100g", 1000],
] as const;

const product = z.object({
  code: z.string().regex(/^\d{4,14}$/),
  product_name: z.string().optional(),
  product_name_cs: z.string().optional(),
  product_name_en: z.string().optional(),
  brands: z.string().optional(),
  nutriments: z.record(z.string(), z.unknown()).optional(),
  countries_tags: z.array(z.string()).optional(),
  serving_size: z.string().optional(),
  serving_quantity: z.coerce.number().optional(),
});

const round = (value: number) => Math.round(value * 100) / 100;

// One OFF product → our food, or null when it can't be logged (no name, or no kcal / protein / carbs / fat).
// Name: the viewer's language, then the other one, then OFF's default name.
export function mapOffProduct(raw: unknown, locale: string): OffFood | null {
  const parsed = product.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const names = locale === "en" ? [p.product_name_en, p.product_name_cs] : [p.product_name_cs, p.product_name_en];
  const name = [...names, p.product_name].map((n) => n?.trim()).find(Boolean);
  const value = (key: string) => {
    const v = Number(p.nutriments?.[key]);
    return p.nutriments?.[key] === undefined || p.nutriments[key] === "" || !Number.isFinite(v) || v < 0 ? null : v;
  };
  const nutrients = Object.fromEntries(NUTRIENTS.map(([field, key, factor]) => [field, value(key) == null ? null : round(value(key)! * factor)])) as Record<
    (typeof NUTRIENTS)[number][0],
    number | null
  >;
  const kj = value("energy_100g") ?? value("energy-kj_100g");
  nutrients.kcal ??= kj == null ? null : Math.round(kj / 4.184);
  if (!name || nutrients.kcal == null || nutrients.protein == null || nutrients.carbs == null || nutrients.fat == null) return null;
  const servings = p.serving_size && p.serving_quantity && p.serving_quantity > 0 ? [{ label: p.serving_size.trim(), grams: p.serving_quantity }] : [];
  return { ...(nutrients as Nutrients), offCode: p.code, name, brand: p.brands?.split(",")[0].trim() || null, czech: Boolean(p.countries_tags?.includes("en:czech-republic")), servings };
}

// Text search, products sold in the Czech Republic first (the order is otherwise OFF's). Throws when OFF fails or times out.
export async function searchOff(query: string, locale: string): Promise<OffFood[]> {
  const params = new URLSearchParams({ search_terms: query, search_simple: "1", action: "process", json: "1", page_size: "20", fields: FIELDS });
  const { products } = z.object({ products: z.array(z.unknown()) }).parse(await get(`/cgi/search.pl?${params}`));
  const foods = products.flatMap((p) => mapOffProduct(p, locale) ?? []);
  return [...foods.filter((f) => f.czech), ...foods.filter((f) => !f.czech)];
}

// One product by its OFF code (resolving a search result when it's logged); null when OFF doesn't know it.
// Throws when OFF fails or times out.
export async function offProduct(code: string, locale: string): Promise<OffFood | null> {
  const data = z.object({ status: z.number(), product: z.unknown().optional() }).parse(await get(`/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`));
  return data.status === 1 ? mapOffProduct(data.product, locale) : null;
}

// An OFF product the first time someone uses it: stored as a Food (shared by everyone), refreshed when used again.
export async function upsertOffFood(food: OffFood) {
  const nutrients = Object.fromEntries(NUTRIENTS.map(([field]) => [field, food[field]])) as Nutrients;
  const data = { ...nutrients, name: food.name, brand: food.brand, servings: food.servings, source: "OFF", ownerId: null };
  return db.food.upsert({ where: { offCode: food.offCode }, create: { ...data, offCode: food.offCode }, update: data });
}
