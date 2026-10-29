"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess } from "@/lib/auth";
import { addDays, diffDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { INTENSITIES, SESSION_TYPES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const score = optional(z.coerce.number().int().min(1).max(10));
const sessionInput = z
  .object({
    id: z.string().optional(), // set → edit that session
    date: z.iso.date(),
    startTime: optional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)),
    type: z.enum(SESSION_TYPES),
    sport: optional(z.string().trim().max(100)),
    durationMin: z.coerce.number().int().min(1).max(720),
    intensity: z.enum(INTENSITIES),
    description: optional(z.string().trim().max(1000)),
    rpe: score,
    felt: score,
    note: optional(z.string().trim().max(1000)),
    // A new session only: the same session every week up to this date (a year at most), each its own row.
    repeatUntil: optional(z.iso.date()),
  })
  .refine((s) => !s.repeatUntil || (s.repeatUntil >= s.date && diffDays(s.date, s.repeatUntil) <= 365), { path: ["repeatUntil"] });

const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The client or their coach adds (optionally repeating weekly) or edits a session. Returns the invalid fields, or null.
export async function saveSession(form: FormData): Promise<{ invalid: string[] } | null> {
  const { client } = await requireClientAccess(String(form.get("clientId")));
  const parsed = sessionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, repeatUntil, ...data } = parsed.data;
  if (id) {
    const { count } = await db.trainingSession.updateMany({ where: { id, clientId: client.id }, data });
    if (count === 0) notFound();
  } else {
    const weeks = repeatUntil ? Math.floor(diffDays(data.date, repeatUntil) / 7) : 0;
    // The repeats are future sessions: what was felt after the first one isn't theirs.
    await db.trainingSession.createMany({
      data: Array.from({ length: weeks + 1 }, (_, i) => ({ ...data, ...(i > 0 && { rpe: null, felt: null, note: null }), date: addDays(data.date, 7 * i), clientId: client.id })),
    });
  }
  refresh(client.id);
  return null;
}

export async function deleteSession(form: FormData) {
  const { client } = await requireClientAccess(String(form.get("clientId")));
  const { count } = await db.trainingSession.deleteMany({ where: { id: String(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}
