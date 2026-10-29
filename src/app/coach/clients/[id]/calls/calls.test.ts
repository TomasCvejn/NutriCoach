import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteCall, saveCall } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("call-coach"), name: "Jana", role: "COACH", timezone: "Europe/Prague" });
  const user = await createUser({ email: uniqueEmail("call-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const call = (clientId: string) => ({ clientId, startsAt: "2026-11-02T18:00", durationMin: "30", link: "https://meet.example.com/abc", agenda: " Plán na závod " });

test("the coach schedules a call in their own timezone; the client is told; moving it tells again, editing the agenda doesn't", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveCall(form(call(client.id)))).toBeNull();
  const saved = await db.call.findFirstOrThrow({ where: { clientId: client.id } });
  expect(saved).toMatchObject({ startsAt: new Date("2026-11-02T17:00:00Z"), durationMin: 30, link: "https://meet.example.com/abc", agenda: "Plán na závod" });
  expect(await db.notification.findMany({ where: { userId: user.id } })).toMatchObject([{ type: "CALL_SCHEDULED", payload: { startsAt: "2026-11-02T17:00:00.000Z" } }]);

  expect(await saveCall(form({ ...call(client.id), id: saved.id, agenda: "Jen gely" }))).toBeNull();
  expect(await db.notification.count({ where: { userId: user.id } })).toBe(1);
  expect(await saveCall(form({ ...call(client.id), id: saved.id, startsAt: "2026-11-03T08:30" }))).toBeNull();
  expect(await db.notification.count({ where: { userId: user.id } })).toBe(2);
  await deleteCall(form({ clientId: client.id, id: saved.id }));
  expect(await db.call.count({ where: { clientId: client.id } })).toBe(0);
});

test("a javascript: or data: link and bad times are refused; the client and another coach can't schedule", async () => {
  const { user, client, coach } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveCall(form({ ...call(client.id), link: "javascript:alert(1)" }))).toEqual({ invalid: ["link"] });
  expect(await saveCall(form({ ...call(client.id), link: "data:text/html,hi" }))).toEqual({ invalid: ["link"] });
  expect(await saveCall(form({ ...call(client.id), startsAt: "tomorrow", durationMin: "0" }))).toEqual({ invalid: ["startsAt", "durationMin"] });
  expect(await saveCall(form({ ...call(client.id), link: "" }))).toBeNull(); // no link is fine
  const saved = await db.call.findFirstOrThrow({ where: { clientId: client.id } });

  request.cookie = await signIn(user.email);
  await expect(saveCall(form(call(client.id)))).rejects.toMatchObject(redirectsTo("/app"));
  const other = await setup();
  request.cookie = await signIn(other.coach.email);
  await expect(saveCall(form(call(client.id)))).rejects.toMatchObject(notFound);
  await expect(saveCall(form({ ...call(other.client.id), id: saved.id }))).rejects.toMatchObject(notFound);
  await expect(deleteCall(form({ clientId: client.id, id: saved.id }))).rejects.toMatchObject(notFound);
  expect(await db.call.count({ where: { clientId: client.id } })).toBe(1);
});
