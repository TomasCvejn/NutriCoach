"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { DRINK_TYPES } from "@/lib/enums";
import { optional } from "@/lib/forms";

// Hydration (training.md): only the client logs; everything is scoped to their own rows.
export type FluidState = { invalid: string[] } | null;

const drink = z.object({
  ml: z.coerce.number().int().min(1).max(5000),
  drinkType: z.enum(DRINK_TYPES),
  sodium: optional(z.coerce.number().int().min(0).max(5000)),
  carbs: optional(z.coerce.number().int().min(0).max(500)),
});
const date = z.object({ date: z.iso.date() });
const invalid = (error: z.ZodError) => ({ invalid: error.issues.map((issue) => String(issue.path[0])) });
const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

export async function addFluid(form: FormData): Promise<FluidState> {
  const { client } = await requireClient();
  const parsed = drink.extend(date.shape).safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  await db.fluidLog.create({ data: { ...parsed.data, clientId: client.id } });
  refresh(client.id);
  return null;
}

export async function updateFluid(form: FormData): Promise<FluidState> {
  const { client } = await requireClient();
  const parsed = drink.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { count } = await db.fluidLog.updateMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id }, data: parsed.data });
  if (count === 0) notFound();
  refresh(client.id);
  return null;
}

export async function deleteFluid(form: FormData) {
  const { client } = await requireClient();
  const { count } = await db.fluidLog.deleteMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}

// "My drinks": save one, log one with a tap, delete one.
export async function savePreset(form: FormData): Promise<FluidState> {
  const { client } = await requireClient();
  const parsed = drink.extend({ name: z.string().trim().min(1).max(50) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  if ((await db.drinkPreset.count({ where: { clientId: client.id } })) >= 20) return { invalid: ["name"] };
  await db.drinkPreset.create({ data: { ...parsed.data, clientId: client.id } });
  refresh(client.id);
  return null;
}

export async function logPreset(form: FormData) {
  const { client } = await requireClient();
  const { presetId, date: day } = z.object({ presetId: z.string(), date: z.iso.date() }).parse(Object.fromEntries(form));
  const preset = await db.drinkPreset.findFirst({ where: { id: presetId, clientId: client.id } });
  if (!preset) notFound();
  await db.fluidLog.create({ data: { clientId: client.id, date: day, ml: preset.ml, drinkType: preset.drinkType, sodium: preset.sodium, carbs: preset.carbs } });
  refresh(client.id);
}

export async function deletePreset(form: FormData) {
  const { client } = await requireClient();
  const { count } = await db.drinkPreset.deleteMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  refresh(client.id);
}

// The quick buttons: 250 or 500 ml of water.
export async function quickAdd(form: FormData) {
  const { client } = await requireClient();
  const { date: day, ml } = z.object({ date: z.iso.date(), ml: z.enum(["250", "500"]) }).parse(Object.fromEntries(form));
  await db.fluidLog.create({ data: { clientId: client.id, date: day, ml: Number(ml), drinkType: "WATER" } });
  refresh(client.id);
}
