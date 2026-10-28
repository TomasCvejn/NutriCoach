"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { FOLLOWED } from "@/lib/enums";
import { optional } from "@/lib/forms";

// A GUIDANCE meal: whether it was followed (empty = unmarked) and the client's note. Only the client writes it; a meal
// with neither has no row.
export async function saveGuidance(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireClient();
  const parsed = z
    .object({ date: z.iso.date(), slot: z.string().trim().min(1).max(100), followed: optional(z.enum(FOLLOWED)), note: optional(z.string().trim().max(1000)) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: parsed.error.issues.map((issue) => String(issue.path[0])) };
  const { date, slot, followed, note } = parsed.data;
  const where = { clientId_date_slot: { clientId: client.id, date, slot } };
  if (followed == null && note == null) await db.guidanceLog.deleteMany({ where: where.clientId_date_slot });
  else await db.guidanceLog.upsert({ where, create: { clientId: client.id, date, slot, followed, note }, update: { followed, note } });
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  return null;
}
