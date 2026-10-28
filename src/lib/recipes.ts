import { NUTRIENT_FIELDS, type NutrientField, nutrientsOf } from "./food-log";

export type Ingredient = { foodId?: string | null; name: string; grams?: number | null };
export type Substitution = { instead: string; use: string; note?: string | null };
type Per100 = Partial<Record<NutrientField, number | null>>;

const round = (value: number) => Math.round(value * 10) / 10;

// A recipe's nutrition, in total and per portion, from its ingredients' foods (per 100 g). A free-text ingredient (no
// food or no grams) or a food that no longer exists makes it incomplete: the numbers then cover the rest only.
export function recipeNutrition(ingredients: Ingredient[], foods: Map<string, Per100>, servings: number) {
  const known = ingredients.flatMap((i) => {
    const food = i.foodId ? foods.get(i.foodId) : undefined;
    return food && i.grams ? [nutrientsOf(food, i.grams)] : [];
  });
  const total = Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f, round(known.reduce((sum, n) => sum + (n[f] ?? 0), 0))])) as Record<NutrientField, number>;
  const perPortion = Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f, round(total[f] / Math.max(servings, 1))])) as Record<NutrientField, number>;
  return { total, perPortion, incomplete: known.length < ingredients.length };
}
