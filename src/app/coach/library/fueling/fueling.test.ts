import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteFuelingTemplate, saveFuelingTemplate, setFuelingOverride } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
const fields = {
  ...{ name: "Long ride", minDurationMin: "120", maxDurationMin: "", minIntensity: "", priority: "3" },
  ...{ preTiming: ["3 h before", "", "1 h before"], preText: ["Rice and eggs", "", "Banana"], preCarbs: ["90", "", ""] },
  ...{ duringCarbsPerHour: "60", duringFluidPerHour: "600", duringSodiumPerHour: "", duringText: " Gel every 25 min " },
  ...{ postWithinMin: "45", postProtein: "30", postCarbs: "", postFluidText: "" },
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("fuel-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("fuel-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const client = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  const session = await db.trainingSession.create({ data: { clientId: client.id, date: "2026-11-02", type: "BIKE", durationMin: 180, intensity: "MODERATE" } });
  return { coach, user, session };
}

test("a template with its rule and phases; blank pre rows drop out; the coach overrides a session, deleting it clears that", async () => {
  const { coach, session } = await setup();
  request.cookie = await signIn(coach.email);
  await expect(saveFuelingTemplate(null, form({ ...fields, sessionTypes: ["BIKE", "RUN"] }))).rejects.toMatchObject(redirectsTo("/coach/library/fueling"));
  const template = await db.fuelingTemplate.findFirstOrThrow({ where: { coachId: coach.id } });
  expect(template).toMatchObject({
    ...{ name: "Long ride", sessionTypes: ["BIKE", "RUN"], minDurationMin: 120, maxDurationMin: null, minIntensity: null, priority: 3 },
    pre: [
      { timing: "3 h before", text: "Rice and eggs", carbs: 90 },
      { timing: "1 h before", text: "Banana", carbs: null },
    ],
    ...{ duringCarbsPerHour: 60, duringFluidPerHour: 600, duringSodiumPerHour: null, duringText: "Gel every 25 min", postWithinMin: 45, postProtein: 30 },
  });

  await setFuelingOverride(form({ sessionId: session.id, templateId: template.id }));
  expect(await db.trainingSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ fuelingTemplateId: template.id });
  await expect(deleteFuelingTemplate(form({ id: template.id }))).rejects.toMatchObject(redirectsTo("/coach/library/fueling"));
  expect(await db.trainingSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ fuelingTemplateId: null });
});

test("bad input is refused; another coach or the client can't edit templates or override", async () => {
  const { coach, user, session } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveFuelingTemplate(null, form({ ...fields, name: " ", minDurationMin: "200", maxDurationMin: "100", priority: "x", preText: ["", "", "Banana"], sessionTypes: ["YOGA"] }))).toEqual({
    invalid: ["name", "sessionTypes", "priority", "pre"],
  });
  expect(await saveFuelingTemplate(null, form({ ...fields, minDurationMin: "200", maxDurationMin: "100" }))).toEqual({ invalid: ["maxDurationMin"] });
  await expect(saveFuelingTemplate(null, form(fields))).rejects.toMatchObject(redirectsTo("/coach/library/fueling"));
  const own = await db.fuelingTemplate.findFirstOrThrow({ where: { coachId: coach.id } });

  const other = await setup();
  request.cookie = await signIn(other.coach.email);
  await expect(saveFuelingTemplate(null, form({ ...fields, id: own.id, name: "Mine now" }))).rejects.toMatchObject(notFound);
  await expect(deleteFuelingTemplate(form({ id: own.id }))).rejects.toMatchObject(notFound);
  await expect(setFuelingOverride(form({ sessionId: session.id, templateId: "" }))).rejects.toMatchObject(notFound); // not their client
  await expect(setFuelingOverride(form({ sessionId: other.session.id, templateId: own.id }))).rejects.toMatchObject(notFound); // not their template

  request.cookie = await signIn(user.email);
  await expect(setFuelingOverride(form({ sessionId: session.id, templateId: own.id }))).rejects.toMatchObject(redirectsTo("/app"));
  expect(await db.fuelingTemplate.findUniqueOrThrow({ where: { id: own.id } })).toMatchObject({ name: "Long ride" });
  expect(await db.trainingSession.findUniqueOrThrow({ where: { id: other.session.id } })).toMatchObject({ fuelingTemplateId: null });
});
