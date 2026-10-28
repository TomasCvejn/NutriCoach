"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { TARGET_FIELDS } from "@/lib/nutrition";

const PORTIONS = TARGET_FIELDS.PORTIONS;

// A PORTIONS counter: the new count of one portion kind in one meal, in 0.5 steps; only the client writes it.
// A meal whose counts are all back at zero has no row, so "nothing logged" stays true for it.
export async function setPortion(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireClient();
  const parsed = z
    .object({ date: z.iso.date(), slot: z.string().trim().min(1).max(100), kind: z.enum(PORTIONS), value: z.coerce.number().min(0).max(20).multipleOf(0.5) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: parsed.error.issues.map((issue) => String(issue.path[0])) };
  const { date, slot, kind, value } = parsed.data;
  const where = { clientId_date_slot: { clientId: client.id, date, slot } };
  const row = await db.portionLog.upsert({ where, create: { clientId: client.id, date, slot, [kind]: value }, update: { [kind]: value } });
  if (PORTIONS.every((p) => row[p] === 0)) await db.portionLog.delete({ where });
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  return null;
}
