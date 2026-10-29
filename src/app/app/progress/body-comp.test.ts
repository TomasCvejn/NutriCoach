import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { latestWeighIn } from "@/lib/body-comp";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteBodyComp, saveBodyComp } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const empty = { weightKg: "", bodyFatPct: "", leanMassKg: "", waistCm: "", hipsCm: "", chestCm: "", thighCm: "", armCm: "", note: "" };

async function setup() {
  const coach = await createUser({ email: uniqueEmail("body-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("body-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id, weightKg: 70 } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}

test("the client and their coach add and edit entries; the latest weigh-in up to a day; delete", async () => {
  const { coach, user, client } = await setup();
  const entry = { clientId: client.id, method: "BIOIMPEDANCE", ...empty };
  request.cookie = await signIn(user.email);
  expect(await saveBodyComp(form({ ...entry, date: "2026-10-01", weightKg: "68.4", bodyFatPct: "24.5", note: " Ráno " }))).toBeNull();
  request.cookie = await signIn(coach.email);
  expect(await saveBodyComp(form({ ...entry, method: "TAPE", date: "2026-10-20", waistCm: "80" }))).toBeNull();
  const [first, second] = await db.bodyComp.findMany({ where: { clientId: client.id }, orderBy: { date: "asc" } });
  expect(first).toMatchObject({ weightKg: 68.4, bodyFatPct: 24.5, leanMassKg: null, note: "Ráno" }); // lean mass is computed on read
  expect(second).toMatchObject({ method: "TAPE", weightKg: null, waistCm: 80 });
  // A tape-only entry isn't a weigh-in.
  expect(await latestWeighIn(client.id)).toEqual({ weightKg: 68.4 });
  expect(await latestWeighIn(client.id, "2026-09-30")).toBeNull();

  expect(await saveBodyComp(form({ ...entry, id: second.id, method: "SCALE", date: "2026-10-20", weightKg: "67.9" }))).toBeNull();
  expect(await latestWeighIn(client.id)).toEqual({ weightKg: 67.9 });
  await deleteBodyComp(form({ clientId: client.id, id: second.id }));
  expect(await db.bodyComp.count({ where: { clientId: client.id } })).toBe(1);
});

test("nothing measured or out-of-range values are refused; another client or coach can't touch the entries", async () => {
  const { user, client } = await setup();
  const entry = { clientId: client.id, method: "SCALE", date: "2026-10-01", ...empty };
  request.cookie = await signIn(user.email);
  expect(await saveBodyComp(form(entry))).toEqual({ invalid: ["values"] });
  expect(await saveBodyComp(form({ ...entry, weightKg: "5", bodyFatPct: "90", method: "GUESS", date: "yesterday" }))).toEqual({ invalid: ["date", "method", "weightKg", "bodyFatPct"] });
  expect(await saveBodyComp(form({ ...entry, weightKg: "70" }))).toBeNull();
  const saved = await db.bodyComp.findFirstOrThrow({ where: { clientId: client.id } });

  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(saveBodyComp(form({ ...entry, weightKg: "71" }))).rejects.toMatchObject(notFound);
  await expect(deleteBodyComp(form({ clientId: client.id, id: saved.id }))).rejects.toMatchObject(notFound);
  // Their own client id with someone else's entry id: nothing to edit or delete.
  await expect(saveBodyComp(form({ ...entry, clientId: other.client.id, id: saved.id, weightKg: "71" }))).rejects.toMatchObject(notFound);
  await expect(deleteBodyComp(form({ clientId: other.client.id, id: saved.id }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.coach.email);
  await expect(saveBodyComp(form({ ...entry, weightKg: "71" }))).rejects.toMatchObject(notFound);
  request.cookie = "";
  await expect(saveBodyComp(form({ ...entry, weightKg: "71" }))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await db.bodyComp.findMany({ where: { clientId: client.id } })).toMatchObject([{ weightKg: 70 }]);
});
