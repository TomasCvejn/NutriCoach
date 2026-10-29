"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireClient, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES } from "@/lib/enums";
import { optional } from "@/lib/forms";
import { notify } from "@/lib/notifications";
import { currentCheckIn } from "@/lib/check-ins";

const comment = optional(z.string().trim().max(500));
const answersInput = z.object({
  ...Object.fromEntries(CHECK_IN_SCALES.map((s) => [s, z.coerce.number().int().min(1).max(10)])),
  ...Object.fromEntries(CHECK_IN_SCALES.map((s) => [`${s}Comment`, comment])),
  questions: optional(z.string().trim().max(2000)),
}) as z.ZodType<Record<string, number | string | null>>;

export type CheckInState = { invalid: string[] } | { already: true } | null;

// The client submits the current period's check-in, once, from its due date on. The coach is told.
export async function submitCheckIn(_: CheckInState, form: FormData): Promise<CheckInState> {
  const { user, client } = await requireClient();
  const period = await currentCheckIn(client, user.timezone);
  if (period.status !== "due" && period.status !== "overdue") return { already: true };
  const parsed = answersInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const a = parsed.data;
  const answers = Object.fromEntries(CHECK_IN_SCALES.map((s) => [s, { score: a[s], comment: a[`${s}Comment`] }]));
  try {
    const checkIn = await db.checkIn.create({ data: { clientId: client.id, dueDate: period.dueDate!, answers, questions: a.questions as string | null } });
    await notify(client.coachId, "CHECK_IN_SUBMITTED", { client: user.name, checkInId: checkIn.id });
  } catch (error) {
    // A double submit races to the unique (client, period) index: the second one is refused.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { already: true };
    throw error;
  }
  revalidatePath("/app", "layout");
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  return null;
}

// The coach sets the client's check-in weekday (1 = Monday … 7 = Sunday).
export async function setCheckInWeekday(form: FormData) {
  const { clientId, weekday } = z.object({ clientId: z.string(), weekday: z.coerce.number().int().min(1).max(7) }).parse(Object.fromEntries(form));
  const { client } = await requireCoachOf(clientId);
  await db.client.update({ where: { id: client.id }, data: { checkInWeekday: weekday } });
  revalidatePath(`/coach/clients/${client.id}`, "layout");
  revalidatePath("/coach/clients");
}
