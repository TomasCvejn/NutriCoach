"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClient, requireClientAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DAY_TYPES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const day = z.object({ clientId: z.string(), date: z.iso.date() });

const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The client or their coach sets a date's day type; empty = derived again (competition > session > rest).
export async function setDayType(form: FormData) {
  await requireUser();
  const { clientId, date, dayType } = day.extend({ dayType: optional(z.enum(DAY_TYPES)) }).parse(Object.fromEntries(form));
  await requireClientAccess(clientId);
  await db.nutritionDay.upsert({
    where: { clientId_date: { clientId, date } },
    create: { clientId, date, dayTypeOverride: dayType },
    update: { dayTypeOverride: dayType },
  });
  refresh(clientId);
}

// The client's note to the coach on a day; the coach only reads it.
export async function saveDayNote(_: { saved: true } | null, form: FormData): Promise<{ saved: true } | null> {
  const { client } = await requireClient();
  const { clientId, date, note } = day.extend({ note: optional(z.string().trim().max(2000)) }).parse(Object.fromEntries(form));
  if (clientId !== client.id) notFound();
  await db.nutritionDay.upsert({ where: { clientId_date: { clientId, date } }, create: { clientId, date, note }, update: { note } });
  refresh(clientId);
  return { saved: true };
}
