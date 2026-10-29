"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { BODY_COMP_METHODS, BODY_FIELDS } from "@/lib/enums";
import { optional } from "@/lib/forms";

const measure = (min: number, max: number) => optional(z.coerce.number().min(min).max(max));
const girth = measure(5, 300);
const bodyCompInput = z
  .object({
    id: z.string().optional(), // set → edit that entry
    date: z.iso.date(),
    method: z.enum(BODY_COMP_METHODS),
    weightKg: measure(20, 400),
    bodyFatPct: measure(2, 75),
    leanMassKg: measure(10, 300),
    ...{ waistCm: girth, hipsCm: girth, chestCm: girth, thighCm: girth, armCm: girth },
    note: optional(z.string().trim().max(1000)),
  })
  .refine((entry) => BODY_FIELDS.some((f) => entry[f] != null), { path: ["values"] });

const refresh = (clientId: string) => {
  revalidatePath("/app/progress");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The client or their coach adds or edits a body-composition entry. Returns the invalid fields ("values" = nothing
// measured), or null when saved.
export async function saveBodyComp(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireClientAccess(String(form.get("clientId")));
  const parsed = bodyCompInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.bodyComp.updateMany({ where: { id, clientId: client.id }, data });
    if (count === 0) notFound();
  } else {
    await db.bodyComp.create({ data: { ...data, clientId: client.id } });
  }
  refresh(client.id);
  return null;
}

export async function deleteBodyComp(form: FormData) {
  const { client } = await requireClientAccess(String(form.get("clientId")));
  const { count } = await db.bodyComp.deleteMany({ where: { id: String(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}
