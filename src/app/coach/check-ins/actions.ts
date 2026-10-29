"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import { optional } from "@/lib/forms";
import { notify } from "@/lib/notifications";

const text = optional(z.string().trim().max(5000));
const feedbackInput = z.object({ checkInId: z.string(), response: z.string().trim().min(1).max(5000), changes: text, newGoals: text, nextSteps: text });

export type FeedbackState = { invalid: string[] } | null;

// The coach publishes their feedback on a check-in: it is reviewed, the client is told, and the queue moves on.
export async function publishFeedback(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  const checkIn = await db.checkIn.findUnique({ where: { id: String(form.get("checkInId")) }, select: { id: true, clientId: true } });
  const { client } = await requireCoachOf(checkIn?.clientId ?? "");
  const parsed = feedbackInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  const { checkInId, ...feedback } = parsed.data;
  // Published once: a second publish (another tab) changes nothing.
  const { count } = await db.checkIn.updateMany({ where: { id: checkInId, reviewedAt: null }, data: { ...feedback, reviewedAt: new Date() } });
  if (count) await notify(client.userId, "FEEDBACK_PUBLISHED", { checkInId });
  revalidatePath("/coach", "layout");
  revalidatePath("/app", "layout");
  redirect("/coach/check-ins");
}
