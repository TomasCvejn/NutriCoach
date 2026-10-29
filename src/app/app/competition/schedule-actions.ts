"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCHEDULE_TYPES } from "@/lib/enums";
import { optional } from "@/lib/forms";
import { ordered, shift } from "@/lib/schedule";

const amount = optional(z.coerce.number().int().min(0).max(5000));
const itemInput = z.object({
  id: z.string().optional(), // set → edit that item
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  type: z.enum(SCHEDULE_TYPES),
  title: z.string().trim().min(1).max(100),
  details: optional(z.string().trim().max(500)),
  carbs: amount,
  fluid: amount,
  sodium: amount,
  caffeine: amount,
  recipeId: optional(z.string()),
});

// The competition and its coach: the schedule is the coach's to write.
async function competitionOf(form: FormData) {
  const competition = await db.competition.findUnique({ where: { id: String(form.get("competitionId")) }, include: { schedule: true } });
  const { coach, client } = await requireCoachOf(competition?.clientId ?? "");
  return { coach, client, competition: competition! };
}
const refresh = (clientId: string) => {
  revalidatePath(`/coach/clients/${clientId}`, "layout");
  revalidatePath("/app", "layout");
};
const nextPosition = (items: { time: string; position: number }[], time: string) => Math.max(-1, ...items.filter((i) => i.time === time).map((i) => i.position)) + 1;

// Adds or edits an item; a recipe link must be one of the coach's published recipes (the ones the client can open).
export async function saveScheduleItem(form: FormData): Promise<{ invalid: string[] } | null> {
  const { coach, client, competition } = await competitionOf(form);
  const parsed = itemInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  if (data.recipeId && !(await db.recipe.findFirst({ where: { id: data.recipeId, coachId: coach.id, status: "PUBLISHED" } }))) return { invalid: ["recipeId"] };
  if (id) {
    const old = competition.schedule.find((i) => i.id === id);
    if (!old) notFound();
    await db.scheduleItem.update({ where: { id }, data: { ...data, position: old.time === data.time ? old.position : nextPosition(competition.schedule, data.time) } });
  } else {
    await db.scheduleItem.create({ data: { ...data, competitionId: competition.id, position: nextPosition(competition.schedule, data.time) } });
  }
  refresh(client.id);
  return null;
}

export async function deleteScheduleItem(form: FormData) {
  const { client, competition } = await competitionOf(form);
  const { count } = await db.scheduleItem.deleteMany({ where: { id: String(form.get("id")), competitionId: competition.id } });
  if (count === 0) notFound();
  refresh(client.id);
}

// A copy right after the original (same time), not ticked.
export async function duplicateScheduleItem(form: FormData) {
  const { client, competition } = await competitionOf(form);
  const item = competition.schedule.find((i) => i.id === form.get("id"));
  if (!item) notFound();
  const { competitionId, time, type, title, details, carbs, fluid, sodium, caffeine, recipeId } = item;
  await db.$transaction([
    ...competition.schedule.filter((i) => i.time === item.time && i.position > item.position).map((i) => db.scheduleItem.update({ where: { id: i.id }, data: { position: i.position + 1 } })),
    db.scheduleItem.create({ data: { competitionId, time, type, title, details, carbs, fluid, sodium, caffeine, recipeId, position: item.position + 1 } }),
  ]);
  refresh(client.id);
}

// Up or down among the items at the same time (the times decide the rest of the order).
export async function moveScheduleItem(form: FormData) {
  const { client, competition } = await competitionOf(form);
  const list = ordered(competition.schedule);
  const index = list.findIndex((i) => i.id === form.get("id"));
  const other = list[index + (form.get("direction") === "up" ? -1 : 1)];
  if (index < 0 || !other || other.time !== list[index].time) notFound();
  await db.$transaction([
    db.scheduleItem.update({ where: { id: list[index].id }, data: { position: other.position } }),
    db.scheduleItem.update({ where: { id: other.id }, data: { position: list[index].position } }),
  ]);
  refresh(client.id);
}

// Every item by ±N minutes; refused when one would leave the day.
export async function shiftSchedule(_: { invalid: string[] } | null, form: FormData): Promise<{ invalid: string[] } | null> {
  const { client, competition } = await competitionOf(form);
  const minutes = z.coerce.number().int().min(-1439).max(1439).safeParse(form.get("minutes"));
  const moved = minutes.success ? shift(competition.schedule, minutes.data) : null;
  if (!moved) return { invalid: ["minutes"] };
  await db.$transaction(moved.map((item) => db.scheduleItem.update({ where: { id: item.id }, data: { time: item.time } })));
  refresh(client.id);
  return null;
}
