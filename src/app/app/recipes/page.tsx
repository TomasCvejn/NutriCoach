import { HeartIcon, SearchIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnderlineTabs } from "@/components/underline-tabs";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { DIET_FLAGS, type DietFlag, RECIPE_CATEGORIES, type RecipeCategory } from "@/lib/enums";
import { type Ingredient, recipeNutrition, recipeWarnings } from "@/lib/recipes";
import { fold } from "@/lib/text";
import { toggleSaved } from "./actions";
import { ingredientFoods, publishedRecipes } from "./data";

const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (v == null ? [] : [v].flat()), z.array(item)).catch([]);
const params = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.enum(RECIPE_CATEGORIES).optional().catch(undefined),
  diet: list(z.enum(DIET_FLAGS)),
  saved: z.literal("1").optional().catch(undefined),
});
type Params = z.infer<typeof params>;

// The client's recipe library (More → Recipes): their coach's published recipes, searched by name or ingredient,
// by category and diet flags, all or the saved ones. The view lives in the URL.
export default async function ClientRecipes({ searchParams }: PageProps<"/app/recipes">) {
  const { client } = await requireClient();
  const p = params.parse(await searchParams);
  const [t, format, recipes, saved] = await Promise.all([
    getTranslations(),
    getFormatter(),
    publishedRecipes(client.coachId),
    db.savedRecipe.findMany({ where: { clientId: client.id }, select: { recipeId: true } }),
  ]);
  const savedIds = new Set(saved.map((s) => s.recipeId));
  const foods = await ingredientFoods(recipes);
  const q = fold(p.q);
  const shown = recipes.filter(
    (r) =>
      (!p.saved || savedIds.has(r.id)) &&
      (!p.category || (r.categories as string[]).includes(p.category)) &&
      p.diet.every((d) => (r.dietFlags as string[]).includes(d)) &&
      (!q || [r.name, ...(r.ingredients as Ingredient[]).map((i) => i.name)].some((text) => fold(text).includes(q))),
  );
  const href = (change: Partial<Params>) => {
    const next = { ...p, ...change };
    const query = new URLSearchParams();
    if (next.saved) query.set("saved", "1");
    if (next.q) query.set("q", next.q);
    if (next.category) query.set("category", next.category);
    for (const d of next.diet) query.append("diet", d);
    return `/app/recipes${query.size ? `?${query}` : ""}`;
  };
  const chip =
    "flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:border-primary aria-[current=true]:bg-primary-soft aria-[current=true]:text-primary-ink sm:h-8";
  const n = (value: number) => format.number(value, { maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t("ClientRecipes.title")}</h1>
      <UnderlineTabs
        label={t("ClientRecipes.tabs")}
        tabs={[
          { href: href({ saved: undefined }), label: t("ClientRecipes.all"), current: !p.saved },
          { href: href({ saved: "1" }), label: t("ClientRecipes.saved"), current: Boolean(p.saved) },
        ]}
      />
      <form action="/app/recipes" className="flex gap-2">
        {p.saved && <input type="hidden" name="saved" value="1" />}
        {p.category && <input type="hidden" name="category" value={p.category} />}
        {p.diet.map((d) => (
          <input key={d} type="hidden" name="diet" value={d} />
        ))}
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" name="q" defaultValue={p.q} maxLength={100} aria-label={t("ClientRecipes.search")} placeholder={t("ClientRecipes.searchPlaceholder")} className="h-10 bg-card pl-9" />
        </div>
        <Button type="submit" variant="outline" className="h-10">
          {t("ClientRecipes.find")}
        </Button>
      </form>
      <nav aria-label={t("ClientRecipes.categories")} className="flex gap-2 overflow-x-auto">
        <Link href={href({ category: undefined })} aria-current={!p.category} className={chip}>
          {t("ClientRecipes.anyCategory")}
        </Link>
        {RECIPE_CATEGORIES.map((c) => (
          <Link key={c} href={href({ category: c })} aria-current={p.category === c} className={chip}>
            {t(`RecipeCategories.${c}`)}
          </Link>
        ))}
      </nav>
      <nav aria-label={t("ClientRecipes.diet")} className="flex gap-2 overflow-x-auto">
        {DIET_FLAGS.map((d) => (
          <Link key={d} href={href({ diet: p.diet.includes(d) ? p.diet.filter((x) => x !== d) : [...p.diet, d] })} aria-current={p.diet.includes(d)} className={chip}>
            {t(`DietFlags.${d}`)}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t(recipes.length === 0 ? "ClientRecipes.none" : p.saved && !p.q && !p.category && !p.diet.length ? "ClientRecipes.noneSaved" : "ClientRecipes.noMatch")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((recipe) => {
            const nutrition = recipeNutrition(recipe.ingredients as Ingredient[], foods, recipe.servings);
            const warnings = recipeWarnings({ allergens: recipe.allergens as string[], dietFlags: recipe.dietFlags as string[] }, { allergens: client.allergens as string[], dietType: client.dietType });
            const isSaved = savedIds.has(recipe.id);
            return (
              <li key={recipe.id} className="flex flex-col gap-2 rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/recipes/${recipe.id}`} className="text-base font-semibold hover:underline">
                    {recipe.name}
                  </Link>
                  <form action={toggleSaved}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-pressed={isSaved} aria-label={t(isSaved ? "ClientRecipes.unsave" : "ClientRecipes.save", { name: recipe.name })} className="-mt-1.5 -mr-2 size-10">
                      <HeartIcon aria-hidden className={isSaved ? "fill-primary text-primary" : "text-muted-foreground"} />
                    </Button>
                  </form>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[recipe.prepMinutes != null && t("Recipes.prep", { minutes: recipe.prepMinutes }), (recipe.categories as RecipeCategory[]).map((c) => t(`RecipeCategories.${c}`)).join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm tabular-nums">
                  {t("ClientRecipes.perPortion", { kcal: n(nutrition.perPortion.kcal), protein: n(nutrition.perPortion.protein) })}
                  {nutrition.incomplete && <span className="text-muted-foreground"> · {t("Recipes.incompleteShort")}</span>}
                </p>
                {(warnings.allergens.length > 0 || warnings.diet) && (
                  <p className="text-sm text-destructive-ink">
                    {[
                      warnings.allergens.length > 0 && t("ClientRecipes.contains", { allergens: warnings.allergens.map((a) => t(`Allergens.${a as "GLUTEN"}`)).join(", ") }),
                      warnings.diet && t(`ClientRecipes.notDiet.${warnings.diet}`),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {(recipe.dietFlags as DietFlag[]).length > 0 && (
                  <p className="text-xs text-muted-foreground">{(recipe.dietFlags as DietFlag[]).map((d) => t(`DietFlags.${d}`)).join(" · ")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
