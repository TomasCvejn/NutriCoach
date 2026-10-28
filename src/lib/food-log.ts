import { MICRONUTRIENTS } from "./enums";

// Every nutrient an entry snapshots: the macros (always set) and the micronutrients (null when the food lacks them).
export const MACRO_FIELDS = ["kcal", "protein", "carbs", "fat"] as const;
export const NUTRIENT_FIELDS = [...MACRO_FIELDS, ...(Object.keys(MICRONUTRIENTS) as (keyof typeof MICRONUTRIENTS)[])] as const;
export type NutrientField = (typeof NUTRIENT_FIELDS)[number];
type Macros = Record<(typeof MACRO_FIELDS)[number], number>;
export type Nutrients = Macros & Record<Exclude<NutrientField, keyof Macros>, number | null>;

const round = (value: number) => Math.round(value * 100) / 100;
const scale = (values: Partial<Record<NutrientField, number | null>>, factor: number) =>
  Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f, values[f] == null ? null : round(values[f]! * factor)])) as Nutrients;

// The nutrients of `grams` of a food given per 100 g.
export const nutrientsOf = (per100g: Partial<Record<NutrientField, number | null>>, grams: number) => scale(per100g, grams / 100);

// A logged entry with a new amount: its own snapshot scaled, so a later change to the food never leaks in.
export const rescale = (entry: Partial<Record<NutrientField, number | null>>, fromGrams: number, toGrams: number) => scale(entry, toGrams / fromGrams);

// kcal and macros summed, as shown: whole kcal, grams to one decimal.
export function totals(entries: Macros[]): Macros {
  const sum = (f: keyof Macros) => entries.reduce((s, e) => s + e[f], 0);
  return { kcal: Math.round(sum("kcal")), protein: Math.round(sum("protein") * 10) / 10, carbs: Math.round(sum("carbs") * 10) / 10, fat: Math.round(sum("fat") * 10) / 10 };
}
