"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { DAY_TYPES, type DayType, type HistoryPayloads, type TrackingMode } from "@/lib/enums";
import { optional } from "@/lib/forms";
import { notify } from "@/lib/notifications";
import { modeFields, TARGET_VALUE_FIELDS, type TargetValues, targetFor } from "@/lib/nutrition";

const whole = (max: number) => optional(z.coerce.number().int().min(0).max(max));
const portions = optional(z.coerce.number().min(0).max(20).multipleOf(0.5));
const values = z
  .object({
    ...{ kcal: whole(10000), protein: whole(1000), carbs: whole(1500), fat: whole(500), fiber: whole(150), sodium: whole(20000) },
    ...{ palms: portions, hands: portions, fists: portions, thumbs: portions },
    fluidMl: whole(10000),
  })
  .partial(); // the form sends only the current mode's fields

export type TargetsState = { saved: true } | { invalid: string[] } | null;

// Saves the targets of every day type the coach filled in and changed (the current mode's fields + fluid), effective
// from one day. The other modes' numbers carry over from the row in force, so switching the mode later keeps them.
// One history row and one "plan updated" notification per save that changes something.
export async function saveTargets(_: TargetsState, form: FormData): Promise<TargetsState> {
  const { client } = await requireCoachOf(z.string().parse(form.get("clientId")));
  const fields = modeFields(client.trackingMode as TrackingMode);
  const effectiveFrom = z.iso.date().safeParse(form.get("effectiveFrom"));
  const invalid: string[] = effectiveFrom.success ? [] : ["effectiveFrom"];
  const entered: { dayType: DayType; data: Partial<TargetValues> }[] = [];
  for (const dayType of DAY_TYPES) {
    const parsed = values.safeParse(Object.fromEntries(fields.map((f) => [f, form.get(`${dayType}.${f}`) ?? ""])));
    if (!parsed.success) invalid.push(...parsed.error.issues.map((issue) => `${dayType}.${String(issue.path[0])}`));
    else if (fields.some((f) => parsed.data[f] != null)) entered.push({ dayType, data: parsed.data });
  }
  if (invalid.length || !effectiveFrom.success) return { invalid };
  if (entered.length === 0) return { invalid: ["empty"] };

  const date = effectiveFrom.data;
  const [rows, { timezone }] = await Promise.all([
    db.nutritionTarget.findMany({ where: { clientId: client.id } }),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } }),
  ]);
  // Each filled day type over its own row in force on that day (no REST fallback); the unchanged ones are left alone.
  const changes = entered.flatMap(({ dayType, data }) => {
    const inForce = targetFor(rows.filter((r) => r.dayType === dayType), date, dayType);
    const carried = Object.fromEntries(TARGET_VALUE_FIELDS.map((f) => [f, inForce?.[f] ?? null])) as TargetValues;
    return fields.every((f) => data[f] === carried[f]) ? [] : [{ dayType, row: { ...carried, ...data } }];
  });
  if (changes.length === 0) return { saved: true };

  const payload: HistoryPayloads["TARGETS"] = { effectiveFrom: date, dayTypes: changes.map((c) => c.dayType) };
  await db.$transaction([
    ...changes.map(({ dayType, row }) =>
      db.nutritionTarget.upsert({
        where: { clientId_dayType_effectiveFrom: { clientId: client.id, dayType, effectiveFrom: date } },
        create: { ...row, clientId: client.id, dayType, effectiveFrom: date },
        update: row,
      }),
    ),
    // The history row is dated the day of the change (the client's day); the payload says from when the targets apply.
    db.historyEvent.create({ data: { clientId: client.id, type: "TARGETS", date: todayIn(timezone), payload } }),
  ]);
  await notify(client.userId, "PLAN_UPDATED", {});
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  return { saved: true };
}
