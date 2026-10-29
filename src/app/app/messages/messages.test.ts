import { expect, test, vi } from "vitest";
import { createUser, requireClientAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { badgesOf } from "@/lib/messages";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteMessage, sendMessage } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("msg-coach"), name: "Jana", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("msg-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}

test("both write in the client's thread; the other one is notified and has it unread", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(user.email);
  expect(await sendMessage(null, form({ clientId: client.id, text: " Dobrý den, mám dotaz. " }))).toBeNull();
  request.cookie = await signIn(coach.email);
  expect(await sendMessage(null, form({ clientId: client.id, text: "Dobrý den, ptejte se." }))).toBeNull();

  expect(await db.message.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } })).toMatchObject([
    { senderId: user.id, text: "Dobrý den, mám dotaz.", readAt: null },
    { senderId: coach.id, text: "Dobrý den, ptejte se." },
  ]);
  expect(await db.notification.findMany({ where: { userId: coach.id } })).toMatchObject([{ type: "NEW_MESSAGE", payload: { from: "Klára", clientId: client.id } }]);
  expect(await badgesOf(coach)).toEqual({ notifications: 1, messages: 1 });
  expect(await badgesOf({ id: user.id, role: "CLIENT" })).toEqual({ notifications: 1, messages: 1 });
});

test("4001 characters and an empty message are refused; deleting: own only, within 5 minutes", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(user.email);
  expect(await sendMessage(null, form({ clientId: client.id, text: "x".repeat(4001) }))).toEqual({ invalid: true });
  expect(await sendMessage(null, form({ clientId: client.id, text: "   " }))).toEqual({ invalid: true });
  expect(await sendMessage(null, form({ clientId: client.id, text: "x".repeat(4000) }))).toBeNull();
  const fresh = await db.message.findFirstOrThrow({ where: { clientId: client.id } });
  const old = await db.message.create({ data: { clientId: client.id, senderId: user.id, text: "Old", createdAt: new Date(Date.now() - 6 * 60 * 1000) } });
  const coachs = await db.message.create({ data: { clientId: client.id, senderId: coach.id, text: "Coach's" } });

  await expect(deleteMessage(form({ id: old.id }))).rejects.toMatchObject(notFound); // after 5 minutes
  await expect(deleteMessage(form({ id: coachs.id }))).rejects.toMatchObject(notFound); // not theirs
  await deleteMessage(form({ id: fresh.id }));
  expect((await db.message.findMany({ where: { clientId: client.id } })).map((m) => m.text).sort()).toEqual(["Coach's", "Old"]);
});

test("another client or coach can't read or write a thread", async () => {
  const { client } = await setup();
  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(requireClientAccess(client.id)).rejects.toMatchObject(notFound); // what the thread pages load through
  await expect(sendMessage(null, form({ clientId: client.id, text: "Hi" }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.coach.email);
  await expect(sendMessage(null, form({ clientId: client.id, text: "Hi" }))).rejects.toMatchObject(notFound);
  const theirs = await db.message.create({ data: { clientId: client.id, senderId: client.userId, text: "Mine" } });
  await expect(deleteMessage(form({ id: theirs.id }))).rejects.toMatchObject(notFound);
  request.cookie = "";
  await expect(sendMessage(null, form({ clientId: client.id, text: "Hi" }))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await db.message.count({ where: { clientId: client.id } })).toBe(1);
});
