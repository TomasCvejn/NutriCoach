"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { NOTE_TYPES } from "@/lib/enums";

const noteInput = z.object({
  id: z.string().optional(), // set → edit that note
  date: z.iso.date(),
  type: z.enum(NOTE_TYPES),
  text: z.string().trim().min(1).max(5000),
  pinned: z.stringbool().default(false), // a checkbox: "on" or absent
});

export type NoteFormState = { invalid: string[] } | null;

// Adds or edits one of the coach's notes on their client. Returns the invalid fields, or null when saved.
export async function saveNote(form: FormData): Promise<NoteFormState> {
  const { client } = await requireCoachOf(z.string().parse(form.get("clientId")));
  const parsed = noteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: parsed.error.issues.map((issue) => String(issue.path[0])) };
  const { id, ...data } = parsed.data;
  if (id) {
    const { count } = await db.coachNote.updateMany({ where: { id, clientId: client.id }, data });
    if (count === 0) notFound();
  } else {
    await db.coachNote.create({ data: { ...data, clientId: client.id } });
  }
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  return null;
}

export async function deleteNote(form: FormData) {
  const { client } = await requireCoachOf(z.string().parse(form.get("clientId")));
  const { count } = await db.coachNote.deleteMany({ where: { id: z.string().parse(form.get("id")), clientId: client.id } });
  if (count === 0) notFound();
  revalidatePath(`/coach/clients/${client.id}`, "layout");
}
