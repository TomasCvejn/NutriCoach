import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Ingredient, Substitution } from "@/lib/recipes";
import { RecipeEditor } from "../recipe-editor";

// Edit one of the coach's recipes; another coach's looks like it doesn't exist.
export default async function EditRecipe({ params }: PageProps<"/coach/library/recipes/[id]">) {
  const coach = await requireCoach();
  const recipe = await db.recipe.findFirst({ where: { id: (await params).id, coachId: coach.id } });
  if (!recipe) notFound();
  const ingredients = recipe.ingredients as Ingredient[];
  const [t, foods] = await Promise.all([
    getTranslations("Recipes"),
    db.food.findMany({ where: { id: { in: ingredients.flatMap((i) => (i.foodId ? [i.foodId] : [])) } }, select: { id: true, kcal: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("editTitle", { name: recipe.name })}</h2>
      <RecipeEditor
        recipe={{
          ...recipe,
          categories: recipe.categories as string[],
          dietFlags: recipe.dietFlags as string[],
          allergens: recipe.allergens as string[],
          ingredients,
          steps: recipe.steps as string[],
          substitutions: recipe.substitutions as Substitution[],
        }}
        foods={Object.fromEntries(foods.map(({ id, ...per100 }) => [id, per100]))}
      />
    </div>
  );
}
