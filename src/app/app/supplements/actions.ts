"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUPPLEMENT_CATEGORIES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const text = (max: number) => optional(z.string().trim().max(max));
const supplementInput = z
  .object({
    id: z.string().optional(), // set → edit that supplement
    name: z.string().trim().min(1).max(100),
    brand: text(100),
    category: z.enum(SUPPLEMENT_CATEGORIES),
    dose: text(100),
    timing: text(200),
    purpose: text(500),
    notes: text(2000),
    activeFrom: optional(z.iso.date()),
    activeTo: optional(z.iso.date()),
  })
  .refine((s) => !s.activeFrom || !s.activeTo || s.activeFrom <= s.activeTo, { path: ["activeTo"] });

// Who may change a supplement: the coach any of their client's; the client only the ones they added themselves.
const editable = (role: string) => (role === "COACH" ? {} : { addedByClient: true });
const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The coach assigns or edits a supplement; the client adds one of their own (flagged for the coach) or edits it.
export async function saveSupplement(form: FormData): Promise<{ invalid: string[] } | null> {
  const { user, client } = await requireClientAccess(String(form.get("clientId")));
  const parsed = supplementInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.supplement.updateMany({ where: { id, clientId: client.id, ...editable(user.role) }, data });
    if (count === 0) notFound();
  } else {
    await db.supplement.create({ data: { ...data, clientId: client.id, addedByClient: user.role === "CLIENT" } });
  }
  refresh(client.id);
  return null;
}

export async function deleteSupplement(form: FormData) {
  const { user, client } = await requireClientAccess(String(form.get("clientId")));
  const { count } = await db.supplement.deleteMany({ where: { id: String(form.get("id")), clientId: client.id, ...editable(user.role) } });
  if (count === 0) notFound();
  refresh(client.id);
}
