"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMPETITION_PRIORITIES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const competitionInput = z.object({
  id: z.string().optional(), // set → edit that competition
  name: z.string().trim().min(1).max(100),
  date: z.iso.date(),
  sport: optional(z.string().trim().max(100)),
  location: optional(z.string().trim().max(100)),
  priority: z.enum(COMPETITION_PRIORITIES),
  notes: optional(z.string().trim().max(2000)),
});
const resultInput = z.object({ id: z.string(), result: optional(z.string().trim().max(200)), felt: optional(z.coerce.number().int().min(1).max(10)) });

const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
  revalidatePath("/coach", "layout");
};

// The coach adds or edits a client's competition. Returns the invalid fields, or null when saved.
export async function saveCompetition(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireCoachOf(String(form.get("clientId")));
  const parsed = competitionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.competition.updateMany({ where: { id, clientId: client.id }, data });
    if (count === 0) notFound();
  } else {
    await db.competition.create({ data: { ...data, clientId: client.id } });
  }
  refresh(client.id);
  return null;
}

export async function deleteCompetition(form: FormData) {
  const { client } = await requireCoachOf(String(form.get("clientId")));
  const { count } = await db.competition.deleteMany({ where: { id: String(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}

// The result and how it felt, by the client or their coach.
export async function saveResult(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireClientAccess(String(form.get("clientId")));
  const parsed = resultInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  const { count } = await db.competition.updateMany({ where: { id, clientId: client.id }, data });
  if (count === 0) notFound();
  refresh(client.id);
  return null;
}
