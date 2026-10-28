import { ChevronLeftIcon, HeartIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Allergen, DietFlag, RecipeCategory } from "@/lib/enums";
import { type Ingredient, recipeNutrition, recipeWarnings, type Substitution } from "@/lib/recipes";
import { toggleSaved } from "../actions";
import { ingredientFoods, publishedRecipe } from "../data";
import { RecipePortions } from "../portions";

// One recipe for the client: a warning when it clashes with their allergies or diet, ingredients and nutrition for the
// chosen portions, steps, substitutions, allergens. Only their coach's published recipes.
export default async function ClientRecipe({ params }: PageProps<"/app/recipes/[id]">) {
  const { client } = await requireClient();
  const recipe = await publishedRecipe(client.coachId, (await params).id);
  const [t, foods, saved] = await Promise.all([
    getTranslations(),
    ingredientFoods([recipe]),
    db.savedRecipe.findUnique({ where: { clientId_recipeId: { clientId: client.id, recipeId: recipe.id } } }),
  ]);
  const ingredients = recipe.ingredients as Ingredient[];
  const nutrition = recipeNutrition(ingredients, foods, recipe.servings);
  const allergens = recipe.allergens as Allergen[];
  const warnings = recipeWarnings({ allergens, dietFlags: recipe.dietFlags as string[] }, { allergens: client.allergens as string[], dietType: client.dietType });
  const steps = recipe.steps as string[];
  const substitutions = recipe.substitutions as Substitution[];

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header>
        <Link href="/app/recipes" className="-ml-1 inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("ClientRecipes.title")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
          <form action={toggleSaved}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <Button type="submit" variant="ghost" size="icon" aria-pressed={Boolean(saved)} aria-label={t(saved ? "ClientRecipes.unsave" : "ClientRecipes.save", { name: recipe.name })} className="size-10">
              <HeartIcon aria-hidden className={saved ? "fill-primary text-primary" : "text-muted-foreground"} />
            </Button>
          </form>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[recipe.prepMinutes != null && t("Recipes.prep", { minutes: recipe.prepMinutes }), (recipe.categories as RecipeCategory[]).map((c) => t(`RecipeCategories.${c}`)).join(", ")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {(warnings.allergens.length > 0 || warnings.diet) && (
        <section aria-labelledby="recipe-warning" className="rounded-lg border border-destructive/30 bg-destructive-soft px-5 py-4 text-sm text-destructive-ink">
          <h2 id="recipe-warning" className="font-semibold">
            {t("ClientRecipes.warning")}
          </h2>
          {warnings.allergens.length > 0 && <p className="mt-1">{t("ClientRecipes.contains", { allergens: warnings.allergens.map((a) => t(`Allergens.${a as Allergen}`)).join(", ") })}</p>}
          {warnings.diet && <p className="mt-1">{t(`ClientRecipes.notDiet.${warnings.diet}`)}</p>}
        </section>
      )}

      <RecipePortions servings={recipe.servings} ingredients={ingredients.map((i) => ({ name: i.name, grams: i.grams ?? null }))} perPortion={nutrition.perPortion} />
      {nutrition.incomplete && <p className="-mt-3 text-xs text-muted-foreground">{t("Recipes.incomplete")}</p>}

      {steps.length > 0 && (
        <section aria-labelledby="recipe-steps" className="rounded-lg border bg-card p-5">
          <h2 id="recipe-steps" className="text-base font-semibold">
            {t("Recipes.steps")}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm marker:text-muted-foreground">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {substitutions.length > 0 && (
        <section aria-labelledby="recipe-subs" className="rounded-lg border bg-card p-5">
          <h2 id="recipe-subs" className="text-base font-semibold">
            {t("Recipes.substitutions")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {substitutions.map((s, i) => (
              <li key={i}>
                {t("ClientRecipes.substitution", { instead: s.instead, use: s.use })}
                {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recipe-allergens" className="rounded-lg border bg-card p-5 text-sm">
        <h2 id="recipe-allergens" className="text-base font-semibold">
          {t("Recipes.fields.allergens")}
        </h2>
        <p className="mt-2">{allergens.length ? allergens.map((a) => t(`Allergens.${a}`)).join(", ") : t("ClientRecipes.noAllergens")}</p>
        {(recipe.dietFlags as DietFlag[]).length > 0 && <p className="mt-1 text-muted-foreground">{(recipe.dietFlags as DietFlag[]).map((d) => t(`DietFlags.${d}`)).join(" · ")}</p>}
      </section>
    </div>
  );
}
