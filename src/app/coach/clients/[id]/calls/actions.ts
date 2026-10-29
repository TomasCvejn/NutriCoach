"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { instantOf } from "@/lib/dates";
import { db } from "@/lib/db";
import { optional } from "@/lib/forms";
import { notify } from "@/lib/notifications";

const callInput = z.object({
  id: z.string().optional(), // set → edit that call
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), // the coach's wall-clock time
  durationMin: z.coerce.number().int().min(5).max(480),
  // A link the client will open: http(s) only, never javascript: or data:.
  link: optional(z.url({ protocol: /^https?$/ }).max(500)),
  agenda: optional(z.string().trim().max(2000)),
});

const refresh = (clientId: string) => {
  revalidatePath("/coach", "layout");
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The coach schedules or moves a call; the client is told (again when the time changes).
export async function saveCall(form: FormData): Promise<{ invalid: string[] } | null> {
  const { coach, client } = await requireCoachOf(String(form.get("clientId")));
  const parsed = callInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, startsAt: local, ...data } = parsed.data;
  const startsAt = instantOf(local, coach.timezone);
  const old = id ? await db.call.findFirst({ where: { id, clientId: client.id } }) : null;
  if (id && !old) notFound();
  if (old) await db.call.update({ where: { id: old.id }, data: { ...data, startsAt } });
  else await db.call.create({ data: { ...data, startsAt, clientId: client.id } });
  if (old?.startsAt.getTime() !== startsAt.getTime()) await notify(client.userId, "CALL_SCHEDULED", { startsAt: startsAt.toISOString() });
  refresh(client.id);
  return null;
}

export async function deleteCall(form: FormData) {
  const { client } = await requireCoachOf(String(form.get("clientId")));
  const { count } = await db.call.deleteMany({ where: { id: String(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}
