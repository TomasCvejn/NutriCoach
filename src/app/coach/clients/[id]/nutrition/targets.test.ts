import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { changeTrackingMode } from "../actions";
import { saveTargets } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
// What the CALORIES form sends for one day type (every rendered field, empty ones as "").
const calories = (dayType: string, v: Partial<Record<"kcal" | "protein" | "carbs" | "fat" | "fiber" | "sodium" | "fluidMl", string>>) =>
  Object.fromEntries(["kcal", "protein", "carbs", "fat", "fiber", "sodium", "fluidMl"].map((f) => [`${dayType}.${f}`, v[f as keyof typeof v] ?? ""]));

async function setup() {
  const coach = await createUser({ email: uniqueEmail("targets-coach"), name: "Targets Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("targets-client"), name: "Tea", role: "CLIENT", timezone: "Pacific/Kiritimati", client: { create: { coachId: coach.id } } });
  request.cookie = await signIn(coach.email);
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const rows = (clientId: string) => db.nutritionTarget.findMany({ where: { clientId }, orderBy: [{ effectiveFrom: "asc" }, { dayType: "asc" }] });
const planNotifications = (userId: string) => db.notification.count({ where: { userId, type: "PLAN_UPDATED" } });

test("a save writes the filled day types, one history row and one notification; older targets stay as history", async () => {
  const { user, client } = await setup();
  const first = { clientId: client.id, effectiveFrom: "2026-10-01", ...calories("REST", { kcal: "2200", protein: "120", carbs: "280", fat: "65", fluidMl: "2150" }), ...calories("TRAINING", { kcal: "2700" }), ...calories("COMPETITION", {}) };
  expect(await saveTargets(null, form(first))).toEqual({ saved: true });
  expect(await rows(client.id)).toMatchObject([
    { dayType: "REST", effectiveFrom: "2026-10-01", kcal: 2200, protein: 120, carbs: 280, fat: 65, fiber: null, fluidMl: 2150 },
    { dayType: "TRAINING", effectiveFrom: "2026-10-01", kcal: 2700, protein: null },
  ]);
  expect(await db.historyEvent.findMany({ where: { clientId: client.id } })).toMatchObject([
    { type: "TARGETS", date: todayIn("Pacific/Kiritimati"), payload: { effectiveFrom: "2026-10-01", dayTypes: ["REST", "TRAINING"] } },
  ]);
  expect(await planNotifications(user.id)).toBe(1);

  // A later day adds rows; the same day again replaces its row instead of adding one.
  expect(await saveTargets(null, form({ ...first, effectiveFrom: "2026-10-15", "REST.kcal": "2100", "TRAINING.kcal": "" }))).toEqual({ saved: true });
  expect(await saveTargets(null, form({ ...first, effectiveFrom: "2026-10-15", "REST.kcal": "2050", "TRAINING.kcal": "" }))).toEqual({ saved: true });
  expect((await rows(client.id)).map((r) => [r.effectiveFrom, r.dayType, r.kcal])).toEqual([
    ["2026-10-01", "REST", 2200],
    ["2026-10-01", "TRAINING", 2700],
    ["2026-10-15", "REST", 2050],
  ]);
  expect(await db.historyEvent.count({ where: { clientId: client.id, type: "TARGETS" } })).toBe(3);
  expect(await planNotifications(user.id)).toBe(3);

  // Saving what is already in force (the form comes pre-filled) changes nothing: no row, no history, no notification.
  expect(await saveTargets(null, form({ ...first, effectiveFrom: "2026-10-20", "REST.kcal": "2050" }))).toEqual({ saved: true });
  expect(await db.nutritionTarget.count({ where: { clientId: client.id } })).toBe(3);
  expect(await planNotifications(user.id)).toBe(3);
});

test("the other mode's numbers carry over, so switching the mode keeps them", async () => {
  const { client } = await setup();
  await saveTargets(null, form({ clientId: client.id, effectiveFrom: "2026-10-01", ...calories("REST", { kcal: "2300", protein: "170", fluidMl: "3300" }) }));
  await changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" }));
  const portions = { "REST.palms": "6", "REST.hands": "4.5", "REST.fists": "6", "REST.thumbs": "4", "REST.fluidMl": "3300" };
  expect(await saveTargets(null, form({ clientId: client.id, effectiveFrom: "2026-10-08", ...portions }))).toEqual({ saved: true });
  expect((await rows(client.id)).at(-1)).toMatchObject({ effectiveFrom: "2026-10-08", palms: 6, hands: 4.5, kcal: 2300, protein: 170, fluidMl: 3300 });
});

test("invalid values, a bad date or an empty form write nothing and notify nobody", async () => {
  const { user, client } = await setup();
  const bad = { clientId: client.id, effectiveFrom: "2026-02-30", ...calories("REST", { kcal: "-5", protein: "12.5" }), ...calories("TRAINING", { fluidMl: "abc" }) };
  expect(await saveTargets(null, form(bad))).toEqual({ invalid: ["effectiveFrom", "REST.kcal", "REST.protein", "TRAINING.fluidMl"] });
  expect(await saveTargets(null, form({ clientId: client.id, effectiveFrom: "2026-10-01", ...calories("REST", {}) }))).toEqual({ invalid: ["empty"] });
  await changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" }));
  expect(await saveTargets(null, form({ clientId: client.id, effectiveFrom: "2026-10-01", "REST.palms": "1.3", "REST.fluidMl": "" }))).toEqual({ invalid: ["REST.palms"] });
  expect(await rows(client.id)).toEqual([]);
  expect(await planNotifications(user.id)).toBe(0);
});

test("another coach and the client can't set targets", async () => {
  const { user, client } = await setup();
  const other = await createUser({ email: uniqueEmail("targets-other"), name: "Other Coach", role: "COACH" });
  const save = { clientId: client.id, effectiveFrom: "2026-10-01", ...calories("REST", { kcal: "2000" }) };
  request.cookie = await signIn(other.email);
  await expect(saveTargets(null, form(save))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(user.email);
  await expect(saveTargets(null, form(save))).rejects.toMatchObject(redirectsTo("/app"));
  expect(await rows(client.id)).toEqual([]);
});
