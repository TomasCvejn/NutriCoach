import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteCompetition, saveCompetition, saveResult } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("comp-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("comp-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const competition = (clientId: string) => ({ clientId, name: " Pražský maraton ", date: "2027-05-02", sport: "", location: "Praha", priority: "A", notes: "" });

test("the coach creates and edits a competition; the client and the coach record the result; the coach deletes it", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveCompetition(form(competition(client.id)))).toBeNull();
  const saved = await db.competition.findFirstOrThrow({ where: { clientId: client.id } });
  expect(saved).toMatchObject({ name: "Pražský maraton", date: "2027-05-02", sport: null, location: "Praha", priority: "A", result: null });
  expect(await saveCompetition(form({ ...competition(client.id), id: saved.id, priority: "B" }))).toBeNull();

  request.cookie = await signIn(user.email);
  expect(await saveResult(form({ clientId: client.id, id: saved.id, result: " 3:28:41 ", felt: "8" }))).toBeNull();
  expect(await db.competition.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ priority: "B", result: "3:28:41", felt: 8 });
  expect(await saveResult(form({ clientId: client.id, id: saved.id, result: "", felt: "11" }))).toEqual({ invalid: ["felt"] });

  request.cookie = await signIn(coach.email);
  expect(await saveResult(form({ clientId: client.id, id: saved.id, result: "3:28:40", felt: "" }))).toBeNull();
  await deleteCompetition(form({ clientId: client.id, id: saved.id }));
  expect(await db.competition.count({ where: { clientId: client.id } })).toBe(0);
});

test("the client can't create, edit or delete a competition; another coach or client is refused; bad input too", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveCompetition(form({ ...competition(client.id), name: " ", date: "soon", priority: "S" }))).toEqual({ invalid: ["name", "date", "priority"] });
  expect(await saveCompetition(form(competition(client.id)))).toBeNull();
  const saved = await db.competition.findFirstOrThrow({ where: { clientId: client.id } });

  request.cookie = await signIn(user.email);
  await expect(saveCompetition(form(competition(client.id)))).rejects.toMatchObject(redirectsTo("/app"));
  await expect(deleteCompetition(form({ clientId: client.id, id: saved.id }))).rejects.toMatchObject(redirectsTo("/app"));

  const other = await setup();
  request.cookie = await signIn(other.coach.email);
  await expect(saveCompetition(form({ ...competition(client.id), id: saved.id }))).rejects.toMatchObject(notFound);
  await expect(saveResult(form({ clientId: client.id, id: saved.id, result: "DNF", felt: "" }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.user.email);
  await expect(saveResult(form({ clientId: other.client.id, id: saved.id, result: "DNF", felt: "" }))).rejects.toMatchObject(notFound);
  expect(await db.competition.findMany({ where: { clientId: client.id } })).toMatchObject([{ id: saved.id, result: null }]);
});
