"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { translatorFor } from "@/i18n/messages";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALLERGENS, DIET_FLAGS, RECIPE_CATEGORIES, RECIPE_STATUSES } from "@/lib/enums";
import { optional } from "@/lib/forms";
import { offProduct, upsertOffFood } from "@/lib/off";
import type { Ingredient } from "@/lib/recipes";

// The editor's dynamic lists arrive as JSON in hidden fields.
const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "not JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);

const text = (max: number) => z.string().trim().min(1).max(max);
const recipeInput = z.object({
  id: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  name: text(150),
  categories: z.array(z.enum(RECIPE_CATEGORIES)),
  prepMinutes: optional(z.coerce.number().int().min(0).max(1440)),
  servings: z.coerce.number().int().min(1).max(50),
  dietFlags: z.array(z.enum(DIET_FLAGS)),
  allergens: z.array(z.enum(ALLERGENS)),
  ingredients: json(
    z.array(z.object({ foodId: z.string().optional(), offCode: z.string().regex(/^\d{4,14}$/).optional(), name: text(150), grams: z.number().positive().max(10000).nullish() })).max(50),
  ),
  steps: json(z.array(text(2000)).max(50)),
  substitutions: json(z.array(z.object({ instead: text(150), use: text(150), note: optional(z.string().trim().max(300)).nullish() })).max(20)),
});

export type RecipeState = { invalid: string[] } | { offUnavailable: true } | null;

// Create or edit one of the coach's recipes. Ingredients come from the coach's own foods or Open Food Facts (an OFF
// product is looked up and stored here on first use), never from a client's foods; free text has no nutrition.
export async function saveRecipe(_: RecipeState, form: FormData): Promise<RecipeState> {
  const coach = await requireCoach();
  const parsed = recipeInput.safeParse({
    ...Object.fromEntries(form),
    categories: form.getAll("categories"),
    dietFlags: form.getAll("dietFlags"),
    allergens: form.getAll("allergens"),
  });
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ingredients, ...data } = parsed.data;

  const ids = ingredients.flatMap((i) => (i.foodId ? [i.foodId] : []));
  const allowed = new Set(
    (await db.food.findMany({ where: { id: { in: ids }, OR: [{ source: "OFF" }, { source: "COACH", ownerId: coach.id }] }, select: { id: true } })).map((f) => f.id),
  );
  if (ids.some((foodId) => !allowed.has(foodId))) return { invalid: ["ingredients"] };
  const resolved: Ingredient[] = [];
  for (const { foodId, offCode, name, grams } of ingredients) {
    let id = foodId ?? null;
    if (!id && offCode) {
      const stored = await db.food.findUnique({ where: { offCode }, select: { id: true } });
      const product = stored ?? (await offProduct(offCode, coach.locale).catch(() => "unavailable" as const));
      if (product === "unavailable") return { offUnavailable: true };
      if (!product) return { invalid: ["ingredients"] };
      id = "id" in product ? product.id : (await upsertOffFood(product)).id;
    }
    resolved.push(id ? { foodId: id, name, grams: grams ?? null } : { name });
  }

  if (id) {
    const { count } = await db.recipe.updateMany({ where: { id, coachId: coach.id }, data: { ...data, ingredients: resolved } });
    if (count === 0) notFound();
  } else {
    await db.recipe.create({ data: { ...data, ingredients: resolved, coachId: coach.id } });
  }
  revalidatePath("/coach/library/recipes");
  redirect("/coach/library/recipes");
}

// A copy of one of the coach's recipes, as a draft, opened in the editor.
export async function duplicateRecipe(form: FormData) {
  const coach = await requireCoach();
  const recipe = await db.recipe.findFirst({ where: { id: z.string().parse(form.get("id")), coachId: coach.id }, omit: { id: true, createdAt: true, updatedAt: true } });
  if (!recipe) notFound();
  const t = await translatorFor(coach.locale);
  const copy = await db.recipe.create({
    data: { ...recipe, name: t("Recipes.copyOf", { name: recipe.name }), status: "DRAFT", categories: recipe.categories ?? [], dietFlags: recipe.dietFlags ?? [], allergens: recipe.allergens ?? [], ingredients: recipe.ingredients ?? [], steps: recipe.steps ?? [], substitutions: recipe.substitutions ?? [] },
  });
  redirect(`/coach/library/recipes/${copy.id}`);
}

// Publish, move back to drafts, archive or restore one of the coach's recipes.
export async function setRecipeStatus(form: FormData) {
  const coach = await requireCoach();
  const { id, status } = z.object({ id: z.string(), status: z.enum(RECIPE_STATUSES) }).parse(Object.fromEntries(form));
  const { count } = await db.recipe.updateMany({ where: { id, coachId: coach.id }, data: { status } });
  if (count === 0) notFound();
  revalidatePath("/coach/library/recipes");
}
