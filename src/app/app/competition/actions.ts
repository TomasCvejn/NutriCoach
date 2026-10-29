"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess, requireCoach, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMPETITION_PRIORITIES, PACKING_GROUPS, TIMELINE_PHASES } from "@/lib/enums";
import { optional } from "@/lib/forms";
import { fromContent, fromLines, tick, type TimelineContent, timelineOf, toContent } from "@/lib/timeline";

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

// The coach writes a competition's timeline (lines in, items out; ticks of unchanged items stay).
const lines = z.string().max(4000).optional();
export async function saveTimeline(form: FormData): Promise<{ invalid: string[] } | null> {
  const competition = await db.competition.findUnique({ where: { id: String(form.get("competitionId")) } });
  const { client } = await requireCoachOf(competition?.clientId ?? "");
  const field = (prefix: string, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, form.get(`${prefix}.${k}`) ?? undefined]));
  const parsed = z
    .object({ priorities: z.record(z.string(), lines), tasks: z.record(z.string(), lines), packing: z.record(z.string(), lines) })
    .safeParse({ priorities: field("priorities", TIMELINE_PHASES), tasks: field("tasks", TIMELINE_PHASES), packing: field("packing", PACKING_GROUPS) });
  if (!parsed.success) return { invalid: ["timeline"] };
  await db.competition.update({ where: { id: competition!.id }, data: { timeline: fromLines(parsed.data, timelineOf(competition!.timeline)) } });
  refresh(client.id);
  return null;
}

// The client (or the coach) ticks a task or a packing item.
export async function tickItem(form: FormData) {
  const competition = await db.competition.findUnique({ where: { id: String(form.get("competitionId")) } });
  const { client } = await requireClientAccess(competition?.clientId ?? "");
  const timeline = tick(timelineOf(competition!.timeline), String(form.get("id")), form.get("done") === "true");
  if (!timeline) notFound();
  await db.competition.update({ where: { id: competition!.id }, data: { timeline } });
  refresh(client.id);
}

// Save a competition's timeline as a template in the coach's library (the texts, without ticks).
export async function saveTimelineTemplate(form: FormData): Promise<{ invalid: string[] } | null> {
  const competition = await db.competition.findUnique({ where: { id: String(form.get("competitionId")) } });
  const { coach, client } = await requireCoachOf(competition?.clientId ?? "");
  const name = z.string().trim().min(1).max(100).safeParse(form.get("name"));
  if (!name.success) return { invalid: ["name"] };
  await db.timelineTemplate.create({ data: { coachId: coach.id, name: name.data, content: toContent(timelineOf(competition!.timeline)) } });
  refresh(client.id);
  revalidatePath("/coach/library/timelines");
  return null;
}

// Apply one of the coach's templates to a competition: its timeline becomes a fresh copy (nothing ticked).
export async function applyTimelineTemplate(form: FormData) {
  const competition = await db.competition.findUnique({ where: { id: String(form.get("competitionId")) } });
  const { coach, client } = await requireCoachOf(competition?.clientId ?? "");
  const template = await db.timelineTemplate.findFirst({ where: { id: String(form.get("templateId")), coachId: coach.id } });
  if (!template) notFound();
  await db.competition.update({ where: { id: competition!.id }, data: { timeline: fromContent(template.content as TimelineContent) } });
  refresh(client.id);
}

export async function deleteTimelineTemplate(form: FormData) {
  const coach = await requireCoach();
  const { count } = await db.timelineTemplate.deleteMany({ where: { id: String(form.get("id")), coachId: coach.id } });
  if (count === 0) notFound();
  revalidatePath("/coach/library/timelines");
}
