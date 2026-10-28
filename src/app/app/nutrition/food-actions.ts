"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { foodFormInput, foodInput } from "@/lib/foods";

export type FoodFormState = { invalid: string[] } | null;

// A coach's library food or a client's own food: the role decides the source, the user is the owner, and only the
// owner edits or deletes it.
export async function saveFood(form: FormData): Promise<FoodFormState> {
  const user = await requireUser();
  const parsed = foodInput.safeParse(foodFormInput(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  const owned = { ownerId: user.id, source: user.role === "COACH" ? "COACH" : "CLIENT" };
  if (id) {
    const { count } = await db.food.updateMany({ where: { id, ...owned }, data });
    if (count === 0) notFound();
  } else {
    await db.food.create({ data: { ...data, ...owned } });
  }
  revalidatePath("/", "layout");
  return null;
}

export async function deleteFood(form: FormData) {
  const user = await requireUser();
  const { count } = await db.food.deleteMany({ where: { id: z.string().parse(form.get("id")), ownerId: user.id } });
  if (count === 0) notFound();
  revalidatePath("/", "layout");
}
