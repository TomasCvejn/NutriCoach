"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pendingInvite, requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRACKING_MODES } from "@/lib/enums";
import { optional } from "@/lib/forms";

const INVITE_DAYS = 7;

const inviteInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(optional(z.email())),
  trackingMode: optional(z.enum(TRACKING_MODES)),
});

export type InviteFormState = { token: string; name: string } | { invalid: string[] } | null;

export async function createInvite(_: InviteFormState, form: FormData): Promise<InviteFormState> {
  const coach = await requireCoach();
  const parsed = inviteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { invalid: parsed.error.issues.map((issue) => String(issue.path[0])) };
  const invite = await db.invite.create({
    data: {
      ...parsed.data,
      coachId: coach.id,
      token: randomBytes(32).toString("base64url"), // 256 bit
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  revalidatePath("/coach/clients");
  return { token: invite.token, name: invite.name };
}

// Only the coach's own pending invites; anything else looks like it doesn't exist.
export async function revokeInvite(form: FormData) {
  const coach = await requireCoach();
  const id = z.string().parse(form.get("id"));
  const { count } = await db.invite.updateMany({ where: { id, coachId: coach.id, ...pendingInvite() }, data: { revokedAt: new Date() } });
  if (count === 0) notFound();
  revalidatePath("/coach/clients");
}
