"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireCoach, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTENSITIES, SESSION_TYPES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const amount = (max: number) => optional(z.coerce.number().int().min(0).max(max));
const text = (max: number) => optional(z.string().trim().max(max));
const templateInput = z
  .object({
    id: z.string().optional(), // set → edit that template
    name: z.string().trim().min(1).max(100),
    sessionTypes: z.array(z.enum(SESSION_TYPES)),
    minDurationMin: amount(1440),
    maxDurationMin: amount(1440),
    minIntensity: optional(z.enum(INTENSITIES)),
    priority: z.coerce.number().int().min(0).max(100),
    pre: z.array(z.object({ timing: z.string().trim().min(1).max(100), text: z.string().trim().min(1).max(300), carbs: amount(500) })).max(10),
    duringCarbsPerHour: amount(150),
    duringFluidPerHour: amount(2000),
    duringSodiumPerHour: amount(3000),
    duringText: text(300),
    postWithinMin: amount(600),
    postProtein: amount(200),
    postCarbs: amount(500),
    postFluidText: text(300),
  })
  .refine((t) => t.minDurationMin == null || t.maxDurationMin == null || t.minDurationMin <= t.maxDurationMin, { path: ["maxDurationMin"] });

export type TemplateState = { invalid: string[] } | null;

// The coach adds or edits a fueling template. Pre-training items come as parallel lists (one per row); blank rows drop out.
export async function saveFuelingTemplate(_: TemplateState, form: FormData): Promise<TemplateState> {
  const coach = await requireCoach();
  const [timings, texts, carbs] = (["preTiming", "preText", "preCarbs"] as const).map((key) => form.getAll(key).map(String));
  const pre = timings.map((timing, i) => ({ timing, text: texts[i], carbs: carbs[i] })).filter((row) => row.timing.trim() || row.text.trim() || row.carbs.trim());
  const parsed = templateInput.safeParse({ ...Object.fromEntries(form), sessionTypes: form.getAll("sessionTypes"), pre });
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.fuelingTemplate.updateMany({ where: { id, coachId: coach.id }, data });
    if (count === 0) notFound();
  } else {
    await db.fuelingTemplate.create({ data: { ...data, coachId: coach.id } });
  }
  revalidatePath("/coach/library/fueling");
  redirect("/coach/library/fueling");
}

// Sessions that used it as their override go back to the matching template (the relation sets them to null).
export async function deleteFuelingTemplate(form: FormData) {
  const coach = await requireCoach();
  const { count } = await db.fuelingTemplate.deleteMany({ where: { id: String(form.get("id")), coachId: coach.id } });
  if (count === 0) notFound();
  revalidatePath("/coach/library/fueling");
  redirect("/coach/library/fueling");
}

// The coach picks a template of their own for one session ("" = back to the matching one).
export async function setFuelingOverride(form: FormData) {
  const session = await db.trainingSession.findUnique({ where: { id: String(form.get("sessionId")) }, select: { id: true, clientId: true } });
  const { coach, client } = await requireCoachOf(session?.clientId ?? "");
  const templateId = String(form.get("templateId") ?? "") || null;
  if (templateId && !(await db.fuelingTemplate.findFirst({ where: { id: templateId, coachId: coach.id } }))) notFound();
  await db.trainingSession.update({ where: { id: session!.id }, data: { fuelingTemplateId: templateId } });
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  revalidatePath("/app", "layout");
}
