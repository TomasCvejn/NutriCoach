"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
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

type Client = Awaited<ReturnType<typeof requireCoachOf>>["client"];
export type PlanFormState = { invalid: string[] } | null;

// Every plan change goes into the client's history (dated the client's day) and tells the client "plan updated".
async function planChanged(client: Client, payload: HistoryPayloads["PLAN"]) {
  const { timezone } = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  await db.historyEvent.create({ data: { clientId: client.id, type: "PLAN", date: todayIn(timezone), payload } });
  await notify(client.userId, "PLAN_UPDATED", {});
  revalidatePath(`/coach/clients/${client.id}`, "layout");
}

const coachClient = (form: FormData) => requireCoachOf(z.string().parse(form.get("clientId")));
const text = (max: number) => optional(z.string().trim().max(max));
const invalidFields = (error: z.ZodError) => ({ invalid: error.issues.map((issue) => String(issue.path[0])) });

const mealInput = z.object({
  id: z.string().optional(),
  dayType: z.enum(DAY_TYPES),
  name: z.string().trim().min(1).max(100),
  timeHint: text(50),
  guidance: text(1000),
  note: text(1000),
  // Sent only in PORTIONS mode; otherwise the stored counts stay as they are.
  ...{ palms: portions.optional(), hands: portions.optional(), fists: portions.optional(), thumbs: portions.optional() },
});

// Adds a meal at the end of its day type, or edits one (it can move to another day type, at the end).
export async function saveMeal(form: FormData): Promise<PlanFormState> {
  const { client } = await coachClient(form);
  const parsed = mealInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalidFields(parsed.error);
  const { id, ...data } = parsed.data;
  const where = { clientId: client.id, dayType: data.dayType };
  const last = await db.planMeal.findFirst({ where, orderBy: { position: "desc" }, select: { position: true } });
  const position = (last?.position ?? -1) + 1;
  if (id) {
    const meal = await db.planMeal.findFirst({ where: { id, clientId: client.id } });
    if (!meal) notFound();
    await db.planMeal.update({ where: { id }, data: { ...data, position: meal.dayType === data.dayType ? meal.position : position } });
  } else {
    await db.planMeal.create({ data: { ...data, clientId: client.id, position } });
  }
  await planChanged(client, { change: "MEALS", dayType: data.dayType });
  return null;
}

export async function deleteMeal(form: FormData) {
  const { client } = await coachClient(form);
  const meal = await db.planMeal.findFirst({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (!meal) notFound();
  await db.planMeal.delete({ where: { id: meal.id } });
  await planChanged(client, { change: "MEALS", dayType: meal.dayType as DayType });
}

const recommendationInput = z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(150), text: text(2000) });

export async function saveRecommendation(form: FormData): Promise<PlanFormState> {
  const { client } = await coachClient(form);
  const parsed = recommendationInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalidFields(parsed.error);
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.planRecommendation.updateMany({ where: { id, clientId: client.id }, data });
    if (count === 0) notFound();
  } else {
    const last = await db.planRecommendation.findFirst({ where: { clientId: client.id }, orderBy: { position: "desc" }, select: { position: true } });
    await db.planRecommendation.create({ data: { ...data, clientId: client.id, position: (last?.position ?? -1) + 1 } });
  }
  await planChanged(client, { change: "RECOMMENDATIONS" });
  return null;
}

export async function deleteRecommendation(form: FormData) {
  const { client } = await coachClient(form);
  const { count } = await db.planRecommendation.deleteMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  await planChanged(client, { change: "RECOMMENDATIONS" });
}

// A new order for a day type's meals or for the recommendations: exactly the ids that are there, each once.
export async function reorderPlan(form: FormData) {
  const { client } = await coachClient(form);
  const ids = z.array(z.string()).parse(form.getAll("ids"));
  const kind = z.enum(["meals", "recommendations"]).parse(form.get("kind"));
  const dayType = kind === "meals" ? z.enum(DAY_TYPES).parse(form.get("dayType")) : undefined;
  const current =
    kind === "meals"
      ? await db.planMeal.findMany({ where: { clientId: client.id, dayType }, select: { id: true } })
      : await db.planRecommendation.findMany({ where: { clientId: client.id }, select: { id: true } });
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !current.every((row) => ids.includes(row.id))) notFound();
  await db.$transaction(
    ids.map((id, position) => (kind === "meals" ? db.planMeal.update({ where: { id }, data: { position } }) : db.planRecommendation.update({ where: { id }, data: { position } }))),
  );
  await planChanged(client, dayType ? { change: "MEALS", dayType } : { change: "RECOMMENDATIONS" });
}

export async function saveSpecifics(_: { saved: true } | null, form: FormData): Promise<{ saved: true } | null> {
  const { client } = await coachClient(form);
  const planSpecifics = text(5000).parse(form.get("planSpecifics"));
  if (planSpecifics === client.planSpecifics) return { saved: true };
  await db.client.update({ where: { id: client.id }, data: { planSpecifics } });
  await planChanged(client, { change: "SPECIFICS" });
  return { saved: true };
}

// "Copy plan from another client" (own clients only): the source's targets in force today become this client's targets
// from today, and its meals and recommendations replace this client's. The specifics stay (they are about this client).
export async function copyPlan(form: FormData) {
  const { client } = await coachClient(form);
  const sourceId = z.string().parse(form.get("sourceId"));
  if (sourceId === client.id) notFound();
  const { client: source } = await requireCoachOf(sourceId);
  const [sourceUser, { timezone }, targets, meals, recommendations] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: source.userId }, select: { name: true } }),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } }),
    db.nutritionTarget.findMany({ where: { clientId: source.id } }),
    db.planMeal.findMany({ where: { clientId: source.id } }),
    db.planRecommendation.findMany({ where: { clientId: source.id } }),
  ]);
  const today = todayIn(timezone);
  const copied = DAY_TYPES.flatMap((dayType) => {
    const row = targetFor(targets.filter((t) => t.dayType === dayType), today, dayType);
    return row ? [{ dayType, values: Object.fromEntries(TARGET_VALUE_FIELDS.map((f) => [f, row[f]])) as TargetValues }] : [];
  });
  await db.$transaction([
    ...copied.map(({ dayType, values }) =>
      db.nutritionTarget.upsert({
        where: { clientId_dayType_effectiveFrom: { clientId: client.id, dayType, effectiveFrom: today } },
        create: { ...values, clientId: client.id, dayType, effectiveFrom: today },
        update: values,
      }),
    ),
    db.planMeal.deleteMany({ where: { clientId: client.id } }),
    db.planMeal.createMany({
      data: meals.map(({ dayType, position, name, timeHint, guidance, palms, hands, fists, thumbs, note }) => ({
        ...{ clientId: client.id, dayType, position, name, timeHint, guidance, note },
        ...{ palms, hands, fists, thumbs },
      })),
    }),
    db.planRecommendation.deleteMany({ where: { clientId: client.id } }),
    db.planRecommendation.createMany({ data: recommendations.map(({ position, title, text }) => ({ clientId: client.id, position, title, text })) }),
  ]);
  await planChanged(client, { change: "COPY", source: sourceUser.name });
}
