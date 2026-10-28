import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import { acceptInvite, createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { changeTrackingMode } from "@/app/coach/clients/[id]/actions";
import { nextStep, previousStep } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};

// A coach and a client who has just accepted their invite (with or without a tracking mode), signed in.
async function invited(trackingMode: string | null) {
  const coach = await createUser({ email: uniqueEmail("onboarding-coach"), name: "Onboarding Coach", role: "COACH" });
  const invite = await db.invite.create({ data: { coachId: coach.id, token: randomUUID(), name: "Nela", trackingMode, expiresAt: new Date(Date.now() + 86_400_000) } });
  const email = uniqueEmail("onboarding-client");
  expect(await acceptInvite({ token: invite.token, timezone: "Europe/Prague", locale: "cs", email })).toBeNull();
  request.cookie = await signIn(email);
  const { id } = await db.client.findFirstOrThrow({ where: { user: { email } } });
  return { coach, clientId: id };
}
const stored = (id: string) => db.client.findUniqueOrThrow({ where: { id }, include: { user: { select: { name: true } } } });

// Every field of the "about" step as the form sends it (empty fields arrive as "").
const about = {
  step: "1",
  ...{ name: "Nela Malá", sex: "FEMALE", birthDate: "1995-03-02", heightCm: "165", weightKg: "60", phone: "" },
  ...{ dietType: "VEGAN", allergens: ["SESAME"], allergiesNote: "", restrictions: "" },
  ...{ sports: "", sportLevel: "", sessionsPerWeek: "", sessionMinutes: "" },
  ...{ likedFoods: "Tofu", dislikedFoods: "", mealsPerDay: "4", healthConditions: "", medications: "", otherInfo: "" },
  preferredTrackingMode: "GUIDANCE",
};
const goal = { step: "2", primaryGoal: "GAIN_MUSCLE", targetWeightKg: "63", targetDate: "2027-06-01", successText: "" };

test("the client goes through the steps, back works, a stale step is ignored, and finishing notifies the coach once", async () => {
  request.cookie = "";
  await expect(nextStep(null, form({ step: "0" }))).rejects.toMatchObject(redirectsTo("/login"));

  const { coach, clientId } = await invited(null);
  await expect(nextStep(null, form({ step: "0" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 1 });

  await expect(nextStep(null, form(about))).rejects.toMatchObject(redirectsTo("/onboarding"));
  // The invite set no mode, so the preference becomes the mode.
  expect(await stored(clientId)).toMatchObject({
    onboardingStep: 2,
    user: { name: "Nela Malá" },
    ...{ sex: "FEMALE", heightCm: 165, dietType: "VEGAN", allergens: ["SESAME"], likedFoods: "Tofu", mealsPerDay: 4, phone: null },
    ...{ preferredTrackingMode: "GUIDANCE", trackingMode: "GUIDANCE", onboardingCompletedAt: null },
  });

  // Back doesn't save; the step just shown again (a stale tab) changes nothing.
  await expect(previousStep(form({ step: "2" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 1 });
  await expect(nextStep(null, form({ ...goal, step: "2" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 1, primaryGoal: null });
  await expect(nextStep(null, form(about))).rejects.toMatchObject(redirectsTo("/onboarding"));

  // The goal step requires the primary goal.
  expect(await nextStep(null, form({ ...goal, primaryGoal: "" }))).toMatchObject({ invalid: ["primaryGoal"], values: { targetWeightKg: "63" } });
  await expect(nextStep(null, form(goal))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 3, primaryGoal: "GAIN_MUSCLE", targetWeightKg: 63, targetDate: "2027-06-01", successText: null });

  const notifications = () => db.notification.findMany({ where: { userId: coach.id } });
  expect(await notifications()).toEqual([]);
  await expect(nextStep(null, form({ step: "3" }))).rejects.toMatchObject(redirectsTo("/app"));
  expect((await stored(clientId)).onboardingCompletedAt).toBeInstanceOf(Date);
  await expect(nextStep(null, form({ step: "3" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  await expect(previousStep(form({ step: "3" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await notifications()).toMatchObject([{ type: "ONBOARDING_COMPLETED", payload: { client: "Nela Malá", clientId }, readAt: null }]);
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 3 });
});

test("the client can't overwrite a mode the invite set; the preference is kept for the coach", async () => {
  const { clientId } = await invited("PORTIONS");
  await nextStep(null, form({ step: "0" })).catch(() => {});
  await expect(nextStep(null, form({ ...about, preferredTrackingMode: "CALORIES" }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 2, trackingMode: "PORTIONS", preferredTrackingMode: "CALORIES" });
});

test("a mode the coach already changed on the dashboard stays; the preference is kept for the coach", async () => {
  const { coach, clientId } = await invited(null);
  const client = request.cookie;
  await nextStep(null, form({ step: "0" })).catch(() => {});
  request.cookie = await signIn(coach.email);
  await changeTrackingMode(form({ clientId, trackingMode: "PORTIONS" }));
  request.cookie = client;
  await expect(nextStep(null, form(about))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 2, trackingMode: "PORTIONS", preferredTrackingMode: "GUIDANCE" });
});

test("invalid answers are refused with what was sent, and nothing is written; no preference leaves the mode alone", async () => {
  const { clientId } = await invited(null);
  await nextStep(null, form({ step: "0" })).catch(() => {});
  const bad = { ...about, heightCm: "400", preferredTrackingMode: "KETO", allergens: ["PIZZA"] };
  expect(await nextStep(null, form(bad))).toEqual({ invalid: ["heightCm", "allergens", "preferredTrackingMode"], values: expect.objectContaining({ heightCm: "400" }) });
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 1, heightCm: null, allergens: [], preferredTrackingMode: null, trackingMode: "CALORIES" });

  // An untouched radio group sends nothing: no preference, and the default mode stays.
  await expect(nextStep(null, form({ ...about, preferredTrackingMode: [] }))).rejects.toMatchObject(redirectsTo("/onboarding"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 2, preferredTrackingMode: null, trackingMode: "CALORIES" });
});

test("a coach can't use the onboarding actions", async () => {
  const { coach, clientId } = await invited(null);
  request.cookie = await signIn(coach.email);
  await expect(nextStep(null, form({ step: "0" }))).rejects.toMatchObject(redirectsTo("/coach"));
  await expect(previousStep(form({ step: "0" }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await stored(clientId)).toMatchObject({ onboardingStep: 0 });
});
