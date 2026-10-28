"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Line = { name: string; grams: number | null };

// The portion selector: ingredient amounts and the nutrition scale to the chosen number of portions.
export function RecipePortions({ servings, ingredients, perPortion }: { servings: number; ingredients: Line[]; perPortion: { kcal: number; protein: number; carbs: number; fat: number } }) {
  const t = useTranslations();
  const format = useFormatter();
  const [portions, setPortions] = useState(servings);
  const n = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  return (
    <section aria-labelledby="recipe-ingredients" className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recipe-ingredients" className="text-base font-semibold">
          {t("Recipes.ingredients")}
        </h2>
        <div role="group" aria-label={t("ClientRecipes.portions")} className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" disabled={portions <= 1} onClick={() => setPortions(portions - 1)} aria-label={t("ClientRecipes.fewer")} className="size-10 sm:size-8">
            <MinusIcon aria-hidden />
          </Button>
          <output aria-live="polite" className="w-24 text-center text-sm tabular-nums">
            {t("Recipes.servingsCount", { count: portions })}
          </output>
          <Button type="button" variant="outline" size="icon" disabled={portions >= 50} onClick={() => setPortions(portions + 1)} aria-label={t("ClientRecipes.more")} className="size-10 sm:size-8">
            <PlusIcon aria-hidden />
          </Button>
        </div>
      </div>
      <ul className="mt-3">
        {ingredients.map((i, index) => (
          <li key={index} className="flex justify-between gap-3 border-t border-rule py-2 text-sm first:border-t-0">
            <span>{i.name}</span>
            {i.grams != null && <span className="flex-none text-muted-foreground tabular-nums">{t("Recipes.grams", { value: n((i.grams * portions) / servings) })}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm tabular-nums">
        <span className="text-muted-foreground">{t("ClientRecipes.forPortions", { count: portions })}: </span>
        {t("ClientRecipes.nutrition", { kcal: n(perPortion.kcal * portions), protein: n(perPortion.protein * portions), carbs: n(perPortion.carbs * portions), fat: n(perPortion.fat * portions) })}
      </p>
    </section>
  );
}
