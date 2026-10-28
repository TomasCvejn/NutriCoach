"use client";

import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGENS, DIET_FLAGS, RECIPE_CATEGORIES } from "@/lib/enums";
import type { NutrientField } from "@/lib/food-log";
import type { FoodResult } from "@/lib/food-search";
import { type Ingredient, recipeNutrition, type Substitution } from "@/lib/recipes";
import { saveRecipe } from "./actions";

type Per100 = Partial<Record<NutrientField, number | null>>;
export type RecipeValues = {
  id?: string;
  name: string;
  categories: string[];
  prepMinutes: number | null;
  servings: number;
  dietFlags: string[];
  allergens: string[];
  ingredients: Ingredient[];
  steps: string[];
  substitutions: Substitution[];
};
// An ingredient row in the editor: a stored food (foodId), an OFF product not stored yet (offCode), or free text.
type Row = { key: number; foodId?: string; offCode?: string; name: string; grams: string };

let nextKey = 0;
const key = () => ++nextKey;

// The recipe form: basics, ingredients with the nutrition computed as they change, steps, substitutions. "Save as draft"
// or "Save and publish" (clients see only published recipes).
export function RecipeEditor({ recipe, foods: storedFoods }: { recipe?: RecipeValues; foods: Record<string, Per100> }) {
  const t = useTranslations();
  const format = useFormatter();
  const id = useId();
  const [state, save, pending] = useActionState(saveRecipe, null);
  const [foods, setFoods] = useState(storedFoods);
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [rows, setRows] = useState<Row[]>(() => (recipe?.ingredients ?? []).map((i) => ({ key: key(), foodId: i.foodId ?? undefined, name: i.name, grams: i.grams?.toString() ?? "" })));
  const [steps, setSteps] = useState(() => (recipe?.steps ?? []).map((text) => ({ key: key(), text })));
  const [subs, setSubs] = useState(() => (recipe?.substitutions ?? []).map((s) => ({ key: key(), instead: s.instead, use: s.use, note: s.note ?? "" })));
  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  const error = (field: string) => (invalid(field) ? t("Recipes.invalid") : undefined);

  const foodOf = (row: Row) => (row.foodId ? foods[row.foodId] : row.offCode ? foods[`off:${row.offCode}`] : undefined);
  const nutrition = recipeNutrition(
    rows.map((r) => ({ foodId: r.foodId ?? (r.offCode && `off:${r.offCode}`), name: r.name, grams: Number(r.grams) || null })),
    new Map(rows.flatMap((r) => (foodOf(r) ? [[r.foodId ?? `off:${r.offCode}`, foodOf(r)!]] : []))),
    Number(servings) || 1,
  );
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const move = <T,>(list: T[], index: number, by: -1 | 1) => {
    const next = [...list];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return next;
  };
  const checks = (name: string, values: readonly string[], selected: string[] | undefined, label: (v: string) => string) => (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <label key={v} className="flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm has-checked:border-primary has-checked:bg-primary-soft sm:h-8">
          <input type="checkbox" name={name} value={v} defaultChecked={selected?.includes(v)} className="size-4 accent-primary" />
          {label(v)}
        </label>
      ))}
    </div>
  );

  return (
    <form action={save} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {recipe?.id && <input type="hidden" name="id" value={recipe.id} />}
      <input type="hidden" name="ingredients" value={JSON.stringify(rows.map(({ foodId, offCode, name, grams }) => ({ foodId, offCode, name, grams: Number(grams) || null })))} />
      <input type="hidden" name="steps" value={JSON.stringify(steps.map((s) => s.text))} />
      <input type="hidden" name="substitutions" value={JSON.stringify(subs.map(({ instead, use, note }) => ({ instead, use, note: note || null })))} />

      <div className="flex flex-col gap-6">
        <section aria-labelledby={`${id}-basics`} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
          <h2 id={`${id}-basics`} className="text-base font-semibold">
            {t("Recipes.basics")}
          </h2>
          <Field id={`${id}-name`} label={t("Recipes.fields.name")} error={error("name")}>
            <Input id={`${id}-name`} name="name" required maxLength={150} defaultValue={recipe?.name} aria-describedby={`${id}-name-note`} className="h-10" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id={`${id}-servings`} label={t("Recipes.fields.servings")} error={error("servings")}>
              <Input id={`${id}-servings`} name="servings" type="number" min={1} max={50} required value={servings} onChange={(e) => setServings(e.target.value)} aria-describedby={`${id}-servings-note`} className="h-10 tabular-nums" />
            </Field>
            <Field id={`${id}-prep`} label={t("Recipes.fields.prepMinutes")} error={error("prepMinutes")}>
              <Input id={`${id}-prep`} name="prepMinutes" type="number" min={0} max={1440} defaultValue={recipe?.prepMinutes ?? ""} aria-describedby={`${id}-prep-note`} className="h-10 tabular-nums" />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("Recipes.fields.categories")}</legend>
            {checks("categories", RECIPE_CATEGORIES, recipe?.categories, (v) => t(`RecipeCategories.${v}`))}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("Recipes.fields.dietFlags")}</legend>
            {checks("dietFlags", DIET_FLAGS, recipe?.dietFlags, (v) => t(`DietFlags.${v}`))}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("Recipes.fields.allergens")}</legend>
            {checks("allergens", ALLERGENS, recipe?.allergens, (v) => t(`Allergens.${v}`))}
          </fieldset>
        </section>

        <section aria-labelledby={`${id}-ingredients`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
          <h2 id={`${id}-ingredients`} className="text-base font-semibold">
            {t("Recipes.ingredients")}
          </h2>
          {invalid("ingredients") && <p className="text-sm text-destructive-ink">{t("Recipes.ingredientsInvalid")}</p>}
          {state && "offUnavailable" in state && <p className="text-sm text-destructive-ink">{t("Recipes.offUnavailable")}</p>}
          {rows.length > 0 && (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-2">
                  {row.foodId || row.offCode ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                      <Input
                        value={row.grams}
                        onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, grams: e.target.value } : r)))}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={t("Recipes.gramsOf", { name: row.name })}
                        className="h-10 w-24 tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">g</span>
                    </>
                  ) : (
                    <Input
                      value={row.name}
                      onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))}
                      maxLength={150}
                      aria-label={t("Recipes.freeText")}
                      placeholder={t("Recipes.freeTextExample")}
                      className="h-10 min-w-0 flex-1"
                    />
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => setRows(rows.filter((r) => r.key !== row.key))} aria-label={t("Recipes.remove", { name: row.name || t("Recipes.freeText") })} className="size-10">
                    <XIcon aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <IngredientSearch
            onPick={(food) => {
              const ref = food.id ?? `off:${food.offCode}`;
              setFoods({ ...foods, [ref]: food });
              setRows([...rows, { key: key(), foodId: food.id ?? undefined, offCode: food.offCode ?? undefined, name: food.name, grams: "100" }]);
            }}
          />
          <Button type="button" variant="ghost" onClick={() => setRows([...rows, { key: key(), name: "", grams: "" }])} className="h-10 self-start px-2.5 text-primary-ink sm:h-8">
            {t("Recipes.addFreeText")}
          </Button>
        </section>

        <section aria-labelledby={`${id}-steps`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
          <h2 id={`${id}-steps`} className="text-base font-semibold">
            {t("Recipes.steps")}
          </h2>
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li key={step.key} className="flex items-start gap-2">
                <Textarea
                  value={step.text}
                  onChange={(e) => setSteps(steps.map((s) => (s.key === step.key ? { ...s, text: e.target.value } : s)))}
                  rows={2}
                  maxLength={2000}
                  aria-label={t("Recipes.stepLabel", { number: i + 1 })}
                  className="min-w-0 flex-1"
                />
                <span className="flex flex-col">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => setSteps(move(steps, i, -1))} aria-label={t("Recipes.stepUp", { number: i + 1 })} className="size-8">
                    <ChevronUpIcon aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === steps.length - 1} onClick={() => setSteps(move(steps, i, 1))} aria-label={t("Recipes.stepDown", { number: i + 1 })} className="size-8">
                    <ChevronDownIcon aria-hidden />
                  </Button>
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setSteps(steps.filter((s) => s.key !== step.key))} aria-label={t("Recipes.stepRemove", { number: i + 1 })} className="size-10">
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
          {invalid("steps") && <p className="text-sm text-destructive-ink">{t("Recipes.stepsInvalid")}</p>}
          <Button type="button" variant="ghost" onClick={() => setSteps([...steps, { key: key(), text: "" }])} className="h-10 self-start px-2.5 text-primary-ink sm:h-8">
            {t("Recipes.addStep")}
          </Button>
        </section>

        <section aria-labelledby={`${id}-subs`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
          <h2 id={`${id}-subs`} className="text-base font-semibold">
            {t("Recipes.substitutions")}
          </h2>
          {subs.map((sub) => {
            const set = (field: "instead" | "use" | "note", value: string) => setSubs(subs.map((s) => (s.key === sub.key ? { ...s, [field]: value } : s)));
            return (
              <div key={sub.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input value={sub.instead} onChange={(e) => set("instead", e.target.value)} maxLength={150} aria-label={t("Recipes.instead")} placeholder={t("Recipes.instead")} className="h-10" />
                <Input value={sub.use} onChange={(e) => set("use", e.target.value)} maxLength={150} aria-label={t("Recipes.use")} placeholder={t("Recipes.use")} className="h-10" />
                <Input value={sub.note} onChange={(e) => set("note", e.target.value)} maxLength={300} aria-label={t("Recipes.subNote")} placeholder={t("Recipes.subNote")} className="h-10" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setSubs(subs.filter((s) => s.key !== sub.key))} aria-label={t("Recipes.subRemove")} className="size-10">
                  <XIcon aria-hidden />
                </Button>
              </div>
            );
          })}
          {invalid("substitutions") && <p className="text-sm text-destructive-ink">{t("Recipes.subsInvalid")}</p>}
          <Button type="button" variant="ghost" onClick={() => setSubs([...subs, { key: key(), instead: "", use: "", note: "" }])} className="h-10 self-start px-2.5 text-primary-ink sm:h-8">
            {t("Recipes.addSubstitution")}
          </Button>
        </section>
      </div>

      {/* The rail: what a portion gives, and saving. */}
      <aside aria-labelledby={`${id}-nutrition`} className="flex flex-col gap-4 rounded-lg border bg-card p-5 xl:sticky xl:top-6">
        <h2 id={`${id}-nutrition`} className="text-base font-semibold">
          {t("Recipes.perPortion")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {(["kcal", "protein", "carbs", "fat"] as const).map((f) => (
            <div key={f}>
              <dt className="text-xs text-muted-foreground">{t(`Calories.bars.${f}`)}</dt>
              <dd className="text-base font-medium tabular-nums">{t(f === "kcal" ? "Recipes.kcal" : "Recipes.grams", { value: n(nutrition.perPortion[f]) })}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground tabular-nums">{t("Recipes.whole", { kcal: n(nutrition.total.kcal), servings: Number(servings) || 1 })}</p>
        {nutrition.incomplete && <p className="text-xs text-warning">{t("Recipes.incomplete")}</p>}
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <Button type="submit" name="status" value="PUBLISHED" disabled={pending} className="h-10">
            {t("Recipes.publish")}
          </Button>
          <Button type="submit" name="status" value="DRAFT" variant="outline" disabled={pending} className="h-10">
            {t("Recipes.saveDraft")}
          </Button>
          {state && "invalid" in state && <p className="text-sm text-destructive-ink">{t("Recipes.fixErrors")}</p>}
        </div>
      </aside>
    </form>
  );
}

// Ingredient search: the coach's foods and Open Food Facts (never a client's foods).
function IngredientSearch({ onPick }: { onPick: (food: FoodResult) => void }) {
  const t = useTranslations("Recipes");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ results: FoodResult[]; offUnavailable: boolean } | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const aborted = new AbortController();
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`, { signal: aborted.signal }).catch(() => null);
      if (res?.ok) setResults(await res.json());
    }, 300);
    return () => {
      clearTimeout(timer);
      aborted.abort();
    };
  }, [query]);
  const shown = query.trim().length >= 2 ? results : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("searchIngredient")} placeholder={t("searchIngredient")} className="h-10 pl-9" />
      </div>
      {shown?.offUnavailable && (
        <p role="status" className="rounded-md border border-warning-edge bg-warning-soft px-3 py-2 text-xs text-warning">
          {t("offUnavailableSearch")}
        </p>
      )}
      {shown && shown.results.length > 0 && (
        <ul aria-label={t("results")} className="flex max-h-64 flex-col overflow-y-auto rounded-md border">
          {shown.results.map((r) => (
            <li key={r.id ?? r.offCode}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQuery("");
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0 truncate">
                  {r.name}
                  {r.brand && <span className="text-muted-foreground"> · {r.brand}</span>}
                </span>
                <span className="flex-none text-xs text-muted-foreground tabular-nums">{t("kcalPer100", { kcal: Math.round(r.kcal) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
