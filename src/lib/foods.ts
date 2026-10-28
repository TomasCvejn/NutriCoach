import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { optional } from "./forms";

// Which foods a user sees and logs (nutrition.md): everyone the Open Food Facts ones; a coach their own and their
// clients' foods; a client their coach's foods and their own. Never another client's.
export function visibleFoods(viewer: { role: "COACH"; id: string } | { role: "CLIENT"; id: string; coachId: string }): Prisma.FoodWhereInput {
  return viewer.role === "COACH"
    ? { OR: [{ source: "OFF" }, { source: "COACH", ownerId: viewer.id }, { source: "CLIENT", owner: { client: { coachId: viewer.id } } }] }
    : { OR: [{ source: "OFF" }, { source: "COACH", ownerId: viewer.coachId }, { source: "CLIENT", ownerId: viewer.id }] };
}

export type Serving = { label: string; grams: number };

const per100 = (max: number) => z.coerce.number().min(0).max(max);
const g = optional(per100(100));
const mg = optional(per100(100_000));

// A coach's or a client's food as the food form sends it. Servings come as repeated servingLabel / servingGrams fields.
export const foodInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(150),
  brand: optional(z.string().trim().max(100)),
  ...{ kcal: per100(900), protein: per100(100), carbs: per100(100), fat: per100(100) },
  // MICRONUTRIENTS, optional.
  ...{ fiber: g, sodium: mg },
  servings: z.array(z.object({ label: z.string().trim().min(1).max(50), grams: z.coerce.number().positive().max(5000) })).max(10),
});

// FormData → what foodInput reads; serving rows left completely empty are dropped.
export function foodFormInput(form: FormData) {
  const grams = form.getAll("servingGrams").map(String);
  const servings = form
    .getAll("servingLabel")
    .map((label, i) => ({ label: String(label), grams: grams[i] ?? "" }))
    .filter((s) => s.label.trim() || s.grams.trim());
  return { ...Object.fromEntries(form), servings };
}
