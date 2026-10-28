import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Ingredient } from "@/lib/recipes";

// What a client sees of recipes: their coach's PUBLISHED ones only. The caller is the signed-in client (requireClient).
export const publishedRecipes = (coachId: string) => db.recipe.findMany({ where: { coachId, status: "PUBLISHED" }, orderBy: { name: "asc" } });

export async function publishedRecipe(coachId: string, id: string) {
  const recipe = await db.recipe.findFirst({ where: { id, coachId, status: "PUBLISHED" } });
  if (!recipe) notFound();
  return recipe;
}

// The foods the recipes' ingredients point to, for recipeNutrition.
export async function ingredientFoods(recipes: { ingredients: unknown }[]) {
  const ids = recipes.flatMap((r) => (r.ingredients as Ingredient[]).flatMap((i) => (i.foodId ? [i.foodId] : [])));
  return new Map((await db.food.findMany({ where: { id: { in: ids } } })).map((f) => [f.id, f]));
}
