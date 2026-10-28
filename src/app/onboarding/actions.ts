"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { GOALS, ONBOARDING_STEPS, TRACKING_MODES, type TrackingMode } from "@/lib/enums";
import { notify } from "@/lib/notifications";
import { PROFILE_SECTIONS, profileInput, type Refused, refused } from "@/lib/profile";

// The step the form was showing. Each action acts only when it is still the stored step, so a stale tab or a double
// submit just shows where onboarding really is.
const posted = z.object({ step: z.coerce.number().int().min(0).max(ONBOARDING_STEPS.length - 1) });

// What each step asks, validated with the profile's own section schemas. The goal step requires the primary goal.
const { personal, dietary, training, preferences, additional, goals } = PROFILE_SECTIONS;
const STEP_FIELDS = {
  about: z.object({
    ...personal.shape,
    ...dietary.shape,
    ...training.shape,
    ...preferences.shape,
    ...additional.shape,
    preferredTrackingMode: z.enum(TRACKING_MODES).optional(), // radios: nothing picked sends nothing
  }),
  goal: goals.extend({ primaryGoal: z.enum(GOALS) }),
};

async function currentStep(form: FormData) {
  const { user, client } = await requireClient();
  const { step } = posted.parse(Object.fromEntries(form));
  if (client.onboardingCompletedAt || step !== client.onboardingStep) redirect("/onboarding");
  return { user, client, step };
}

// Next: saves the step's answers and moves on; on the last step completes onboarding and tells the coach.
export async function nextStep(_: Refused | null, form: FormData): Promise<Refused | null> {
  const { user, client, step } = await currentStep(form);
  const key = ONBOARDING_STEPS[step];

  if (key === "done") {
    const completed = await db.client.updateMany({ where: { id: client.id, onboardingCompletedAt: null }, data: { onboardingCompletedAt: new Date() } });
    if (completed.count) await notify(client.coachId, "ONBOARDING_COMPLETED", { client: user.name, clientId: client.id });
    redirect("/app");
  }

  let answers: { name?: string; preferredTrackingMode?: TrackingMode | null } & Prisma.ClientUpdateInput = {};
  if (key !== "welcome") {
    const input = profileInput(form);
    const parsed = STEP_FIELDS[key].safeParse(input);
    if (!parsed.success) return refused(parsed.error, input);
    answers = parsed.data;
  }
  const { name, ...data } = answers;
  // The coach decides the mode: one set by the invite or changed on the dashboard (a history row) stays, otherwise the
  // preference becomes the mode until the coach changes it.
  const [invite, changed] = data.preferredTrackingMode
    ? await Promise.all([
        db.invite.findUnique({ where: { clientId: client.id }, select: { trackingMode: true } }),
        db.historyEvent.count({ where: { clientId: client.id, type: "TRACKING_MODE" } }),
      ])
    : [];
  const trackingMode = data.preferredTrackingMode && !invite?.trackingMode && !changed ? data.preferredTrackingMode : undefined;
  await db.client.update({
    where: { id: client.id },
    data: { ...data, trackingMode, onboardingStep: step + 1, user: name ? { update: { name } } : undefined },
  });
  redirect("/onboarding");
}

// Back: one step back without saving the shown step.
export async function previousStep(form: FormData) {
  const { client, step } = await currentStep(form);
  if (step > 0) await db.client.update({ where: { id: client.id }, data: { onboardingStep: step - 1 } });
  redirect("/onboarding");
}
