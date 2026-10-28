"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { nutrientsOf, rescale } from "@/lib/food-log";
import { type Serving, visibleFoods } from "@/lib/foods";
import { optional } from "@/lib/forms";
import { offProduct, upsertOffFood } from "@/lib/off";

// The CALORIES food log; only the client writes it (the coach reads the day).
export type EntryState = { invalid: string[] } | { offUnavailable: true } | null;

const where = z.object({ date: z.iso.date(), slot: z.string().trim().min(1).max(100) });
const amount = z.discriminatedUnion("by", [
  z.object({ by: z.literal("grams"), grams: z.coerce.number().positive().max(5000) }),
  z.object({ by: z.literal("serving"), serving: z.coerce.number().int().min(0), count: z.coerce.number().positive().max(50) }),
]);
const invalid = (error: z.ZodError) => ({ invalid: [...new Set(error.issues.map((issue) => String(issue.path.at(-1) ?? issue.path[0])))] });
const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// A food from the search: a stored food the client may see (foodId), or an OFF product (offCode) looked up and stored
// here on the server on first use, so no nutrient value is ever taken from the browser.
export async function addFoodEntry(form: FormData): Promise<EntryState> {
  const { user, client } = await requireClient();
  const input = Object.fromEntries(form);
  const parsed = where.extend({ foodId: z.string().min(1).optional(), offCode: z.string().regex(/^\d{4,14}$/).optional() }).and(amount).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { date, slot, foodId, offCode } = parsed.data;

  let food;
  if (foodId) {
    food = await db.food.findFirst({ where: { AND: [visibleFoods({ role: "CLIENT", id: user.id, coachId: client.coachId }), { id: foodId }] } });
  } else if (offCode) {
    food = await db.food.findUnique({ where: { offCode } });
    if (!food) {
      const product = await offProduct(offCode, user.locale).catch(() => "unavailable" as const);
      if (product === "unavailable") return { offUnavailable: true };
      food = product && (await upsertOffFood(product));
    }
  }
  if (!food) notFound();

  const a = parsed.data;
  const serving = a.by === "serving" ? (food.servings as Serving[])[a.serving] : null;
  if (serving === undefined) return { invalid: ["serving"] };
  const grams = a.by === "grams" ? a.grams : serving!.grams * a.count;
  await db.foodEntry.create({
    data: {
      ...{ clientId: client.id, date, slot, foodId: food.id, name: food.name, brand: food.brand, grams },
      ...(a.by === "serving" && { servingLabel: serving!.label, servingCount: a.count }),
      ...nutrientsOf(food, grams),
    },
  });
  refresh(client.id);
  return null;
}

const macro = (max: number) => z.union([z.literal(""), z.coerce.number().min(0).max(max)]).transform((v) => (v === "" ? 0 : v));
// kcal is required (an empty field must not become 0 kcal); empty macros are 0.
const quick = { kcal: z.string().trim().min(1).transform(Number).pipe(z.number().min(0).max(10000)), protein: macro(1000), carbs: macro(1500), fat: macro(500) };

// Quick add: kcal and macros only, with an optional name.
export async function addQuickEntry(form: FormData): Promise<EntryState> {
  const { client } = await requireClient();
  const parsed = where.extend({ name: optional(z.string().trim().max(100)), ...quick }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  await db.foodEntry.create({ data: { ...parsed.data, clientId: client.id } });
  refresh(client.id);
  return null;
}

// Edit an entry: a new amount (its own snapshot rescaled) or, for a quick add, new numbers; and / or another meal.
export async function updateEntry(form: FormData): Promise<EntryState> {
  const { client } = await requireClient();
  const entry = await db.foodEntry.findFirst({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (!entry) notFound();
  const slot = where.shape.slot.safeParse(form.get("slot"));
  if (!slot.success) return { invalid: ["slot"] };

  let data;
  if (entry.grams == null) {
    const parsed = z.object({ name: optional(z.string().trim().max(100)), ...quick }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    data = parsed.data;
  } else if (entry.servingCount != null) {
    const count = z.coerce.number().positive().max(50).safeParse(form.get("count"));
    if (!count.success) return { invalid: ["count"] };
    const grams = (entry.grams / entry.servingCount) * count.data;
    data = { servingCount: count.data, grams, ...rescale(entry, entry.grams, grams) };
  } else {
    const grams = z.coerce.number().positive().max(5000).safeParse(form.get("grams"));
    if (!grams.success) return { invalid: ["grams"] };
    data = { grams: grams.data, ...rescale(entry, entry.grams, grams.data) };
  }
  await db.foodEntry.update({ where: { id: entry.id }, data: { ...data, slot: slot.data } });
  refresh(client.id);
  return null;
}

export async function deleteEntry(form: FormData) {
  const { client } = await requireClient();
  const { count } = await db.foodEntry.deleteMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}

// Copy a meal (one slot) or the whole day from another date into this one. The copies are new entries with the same
// snapshot, so editing either day later leaves the other alone. Returns how many were copied (0 = nothing there).
export async function copyEntries(form: FormData): Promise<{ copied: number } | { invalid: string[] }> {
  const { client } = await requireClient();
  const parsed = z
    .object({ date: z.iso.date(), from: z.iso.date(), slot: optional(z.string().trim().min(1).max(100)) })
    .refine((v) => v.from !== v.date, { path: ["from"] })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { date, from, slot } = parsed.data;
  const source = await db.foodEntry.findMany({
    where: { clientId: client.id, date: from, ...(slot && { slot }) },
    orderBy: { createdAt: "asc" },
    omit: { id: true, createdAt: true, updatedAt: true },
  });
  await db.foodEntry.createMany({ data: source.map((entry) => ({ ...entry, date })) });
  refresh(client.id);
  return { copied: source.length };
}
