import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { addFluid, deleteFluid, deletePreset, logPreset, quickAdd, savePreset, updateFluid } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const date = "2026-10-20";

async function setup() {
  const coach = await createUser({ email: uniqueEmail("fluid-coach"), name: "Coach", role: "COACH" });
  const client = async () => {
    const user = await createUser({ email: uniqueEmail("fluid-client"), name: "Klient", role: "CLIENT", client: { create: { coachId: coach.id } } });
    return { user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
  };
  return { coach, a: await client(), b: await client() };
}
const logs = (clientId: string) => db.fluidLog.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });

test("the client logs water quickly, any drink with sodium and carbs, edits and deletes; saved drinks log with a tap", async () => {
  const { a } = await setup();
  request.cookie = await signIn(a.user.email);
  await quickAdd(form({ date, ml: "500" }));
  expect(await addFluid(form({ date, ml: "750", drinkType: "ELECTROLYTE", sodium: "450", carbs: "" }))).toBeNull();
  const [water, iso] = await logs(a.client.id);
  expect([water, iso]).toMatchObject([
    { ml: 500, drinkType: "WATER", sodium: null },
    { ml: 750, drinkType: "ELECTROLYTE", sodium: 450, carbs: null },
  ]);
  expect(await updateFluid(form({ id: iso.id, ml: "600", drinkType: "SPORTS", sodium: "", carbs: "40" }))).toBeNull();
  expect(await db.fluidLog.findUniqueOrThrow({ where: { id: iso.id } })).toMatchObject({ ml: 600, drinkType: "SPORTS", sodium: null, carbs: 40 });
  await deleteFluid(form({ id: water.id }));

  expect(await savePreset(form({ name: "Ionťák", ml: "500", drinkType: "ELECTROLYTE", sodium: "300", carbs: "30" }))).toBeNull();
  const preset = await db.drinkPreset.findFirstOrThrow({ where: { clientId: a.client.id } });
  await logPreset(form({ presetId: preset.id, date }));
  expect((await logs(a.client.id)).map((l) => [l.ml, l.drinkType, l.sodium])).toEqual([
    [600, "SPORTS", null],
    [500, "ELECTROLYTE", 300],
  ]);
  await deletePreset(form({ id: preset.id }));
  expect(await db.drinkPreset.count({ where: { clientId: a.client.id } })).toBe(0);
});

test("bad amounts are refused; another client's drinks and presets are out of reach; a coach can't log", async () => {
  const { coach, a, b } = await setup();
  request.cookie = await signIn(b.user.email);
  await addFluid(form({ date, ml: "300", drinkType: "WATER", sodium: "", carbs: "" }));
  await savePreset(form({ name: "Bářin", ml: "300", drinkType: "WATER", sodium: "", carbs: "" }));
  const [bLog] = await logs(b.client.id);
  const bPreset = await db.drinkPreset.findFirstOrThrow({ where: { clientId: b.client.id } });

  request.cookie = await signIn(a.user.email);
  expect(await addFluid(form({ date, ml: "0", drinkType: "JUICE", sodium: "-1", carbs: "" }))).toEqual({ invalid: ["ml", "drinkType", "sodium"] });
  await expect(quickAdd(form({ date, ml: "5000" }))).rejects.toThrow();
  await expect(updateFluid(form({ id: bLog.id, ml: "1", drinkType: "WATER", sodium: "", carbs: "" }))).rejects.toMatchObject(notFound);
  await expect(deleteFluid(form({ id: bLog.id }))).rejects.toMatchObject(notFound);
  await expect(logPreset(form({ presetId: bPreset.id, date }))).rejects.toMatchObject(notFound);
  await expect(deletePreset(form({ id: bPreset.id }))).rejects.toMatchObject(notFound);
  expect(await logs(a.client.id)).toEqual([]);

  request.cookie = await signIn(coach.email);
  await expect(quickAdd(form({ date, ml: "250" }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await logs(b.client.id)).toMatchObject([{ ml: 300 }]);
});
