import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteSupplement, saveSupplement } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("sup-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("sup-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const supplement = (clientId: string, name: string) => ({
  ...{ clientId, name, brand: "", category: "DAILY", dose: "3 g", timing: "", purpose: "", notes: "" },
  ...{ activeFrom: "", activeTo: "" },
});

test("the coach assigns, the client adds their own (flagged); each edits what is theirs to edit", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveSupplement(form({ ...supplement(client.id, " Creatine "), timing: "Po tréninku", activeFrom: "2026-10-01" }))).toBeNull();
  request.cookie = await signIn(user.email);
  expect(await saveSupplement(form({ ...supplement(client.id, "Vitamin D"), dose: "2000 IU" }))).toBeNull();
  const [creatine, vitamin] = await db.supplement.findMany({ where: { clientId: client.id }, orderBy: { name: "asc" } });
  expect(creatine).toMatchObject({ name: "Creatine", dose: "3 g", timing: "Po tréninku", activeFrom: "2026-10-01", addedByClient: false });
  expect(vitamin).toMatchObject({ name: "Vitamin D", dose: "2000 IU", addedByClient: true });

  // The client edits their own, not the coach's.
  expect(await saveSupplement(form({ ...supplement(client.id, "Vitamin D3"), id: vitamin.id }))).toBeNull();
  await expect(saveSupplement(form({ ...supplement(client.id, "Mine now"), id: creatine.id }))).rejects.toMatchObject(notFound);
  await expect(deleteSupplement(form({ clientId: client.id, id: creatine.id }))).rejects.toMatchObject(notFound);
  // The coach edits either; the flag stays.
  request.cookie = await signIn(coach.email);
  expect(await saveSupplement(form({ ...supplement(client.id, "Vitamin D3"), id: vitamin.id, dose: "1000 IU" }))).toBeNull();
  expect(await db.supplement.findUniqueOrThrow({ where: { id: vitamin.id } })).toMatchObject({ dose: "1000 IU", addedByClient: true });
  await deleteSupplement(form({ clientId: client.id, id: creatine.id }));
  expect(await db.supplement.count({ where: { clientId: client.id } })).toBe(1);
});

test("bad input; another client or coach can't add, edit or delete", async () => {
  const { coach, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveSupplement(form({ ...supplement(client.id, " "), category: "WEEKLY", activeFrom: "2026-11-01", activeTo: "2026-10-01" }))).toEqual({ invalid: ["name", "category"] });
  expect(await saveSupplement(form({ ...supplement(client.id, "Iron"), activeFrom: "2026-11-01", activeTo: "2026-10-01" }))).toEqual({ invalid: ["activeTo"] });
  expect(await saveSupplement(form(supplement(client.id, "Iron")))).toBeNull();
  const iron = await db.supplement.findFirstOrThrow({ where: { clientId: client.id } });

  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(saveSupplement(form(supplement(client.id, "Theirs")))).rejects.toMatchObject(notFound);
  await expect(saveSupplement(form({ ...supplement(other.client.id, "Theirs"), id: iron.id }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.coach.email);
  await expect(deleteSupplement(form({ clientId: client.id, id: iron.id }))).rejects.toMatchObject(notFound);
  request.cookie = "";
  await expect(saveSupplement(form(supplement(client.id, "Anon")))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await db.supplement.findMany({ where: { clientId: client.id } })).toMatchObject([{ name: "Iron" }]);
});
