import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { Pill } from "@/components/pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RecipeCategory, RecipeStatus } from "@/lib/enums";
import { type Ingredient, recipeNutrition } from "@/lib/recipes";
import { duplicateRecipe, setRecipeStatus } from "./actions";

const FILTERS = ["current", "PUBLISHED", "DRAFT", "ARCHIVED"] as const;
const params = z.object({ show: z.enum(FILTERS).catch("current") });

// Library → Recipes: the coach's recipes (published and drafts; archived on request) with kcal and protein per portion.
export default async function LibraryRecipes({ searchParams }: PageProps<"/coach/library/recipes">) {
  const coach = await requireCoach();
  const { show } = params.parse(await searchParams);
  const [t, format, recipes] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.recipe.findMany({ where: { coachId: coach.id, status: show === "current" ? { not: "ARCHIVED" } : show }, orderBy: { name: "asc" } }),
  ]);
  const foodIds = recipes.flatMap((r) => (r.ingredients as Ingredient[]).flatMap((i) => (i.foodId ? [i.foodId] : [])));
  const foods = new Map((await db.food.findMany({ where: { id: { in: foodIds } } })).map((f) => [f.id, f]));
  const n = (value: number) => format.number(value, { maximumFractionDigits: 0 });

  return (
    <section aria-labelledby="recipes-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="recipes-title" className="text-lg font-semibold">
            {t("Recipes.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("Recipes.lead")}</p>
        </div>
        <Link href="/coach/library/recipes/new" className={buttonVariants({ className: "h-10 px-3 sm:h-9" })}>
          {t("Recipes.new")}
        </Link>
      </div>
      <nav aria-label={t("Recipes.filter")} className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "current" ? "/coach/library/recipes" : `/coach/library/recipes?show=${f}`}
            aria-current={f === show ? "page" : undefined}
            className="flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink sm:h-8"
          >
            {t(`Recipes.filters.${f}`)}
          </Link>
        ))}
      </nav>
      {recipes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t(show === "current" ? "Recipes.empty" : "Recipes.emptyFiltered")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-2 text-left font-normal">{t("Recipes.columns.name")}</th>
              <th className="hidden w-28 py-2 text-right font-normal sm:table-cell">{t("Recipes.columns.kcal")}</th>
              <th className="hidden w-28 py-2 text-right font-normal sm:table-cell">{t("Recipes.columns.protein")}</th>
              <th className="hidden w-32 py-2 pl-6 text-left font-normal md:table-cell">{t("Recipes.columns.status")}</th>
              <th className="w-48 py-2">
                <span className="sr-only">{t("Recipes.columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => {
              const nutrition = recipeNutrition(recipe.ingredients as Ingredient[], foods, recipe.servings);
              const status = recipe.status as RecipeStatus;
              return (
                <tr key={recipe.id} className="border-t border-rule">
                  <td className="py-3 pr-4">
                    <Link href={`/coach/library/recipes/${recipe.id}`} className="font-medium hover:underline">
                      {recipe.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[
                        (recipe.categories as RecipeCategory[]).map((c) => t(`RecipeCategories.${c}`)).join(", "),
                        recipe.prepMinutes != null && t("Recipes.prep", { minutes: recipe.prepMinutes }),
                        t("Recipes.servingsCount", { count: recipe.servings }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="hidden py-3 text-right tabular-nums sm:table-cell">
                    {n(nutrition.perPortion.kcal)}
                    {nutrition.incomplete && <span className="block text-xs text-warning">{t("Recipes.incompleteShort")}</span>}
                  </td>
                  <td className="hidden py-3 text-right tabular-nums sm:table-cell">{t("Recipes.grams", { value: n(nutrition.perPortion.protein) })}</td>
                  <td className="hidden py-3 pl-6 md:table-cell">
                    <Pill tone={status === "PUBLISHED" ? "accent" : "neutral"}>{t(`RecipeStatuses.${status}`)}</Pill>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <form action={duplicateRecipe}>
                        <input type="hidden" name="id" value={recipe.id} />
                        <Button type="submit" variant="ghost" className="h-10 px-2.5 sm:h-8" aria-label={t("Recipes.duplicateOf", { name: recipe.name })}>
                          {t("Recipes.duplicate")}
                        </Button>
                      </form>
                      <form action={setRecipeStatus}>
                        <input type="hidden" name="id" value={recipe.id} />
                        <input type="hidden" name="status" value={status === "ARCHIVED" ? "DRAFT" : "ARCHIVED"} />
                        <Button type="submit" variant="ghost" className="h-10 px-2.5 text-muted-foreground sm:h-8" aria-label={t(status === "ARCHIVED" ? "Recipes.restoreOf" : "Recipes.archiveOf", { name: recipe.name })}>
                          {t(status === "ARCHIVED" ? "Recipes.restore" : "Recipes.archive")}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
