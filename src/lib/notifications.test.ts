import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import { markAllRead, markRead, openNotification } from "@/app/app/notifications/actions";
import { notFound, redirectsTo, signIn } from "@/test/auth";
import { db } from "./db";
import { NOTIFICATION_TYPES } from "./enums";
import { notify } from "./notifications";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

async function as(email: string) {
  request.cookie = await signIn(email);
}

const userId = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email } })).id;
const withId = (id: string) => {
  const form = new FormData();
  form.set("id", id);
  return form;
};

test("notify writes one row; the same key twice stays one row, no key never dedupes", async () => {
  const general = await userId("general@demo.cz");
  const key = randomUUID();
  await notify(general, "CHECK_IN_DUE", { dueDate: "2026-10-26" }, key);
  await notify(general, "CHECK_IN_DUE", { dueDate: "2026-10-26" }, key);
  expect(await db.notification.findMany({ where: { userId: general, key } })).toMatchObject([
    { type: "CHECK_IN_DUE", payload: { dueDate: "2026-10-26" }, readAt: null },
  ]);

  const before = await db.notification.count({ where: { userId: general, type: "PLAN_UPDATED" } });
  await Promise.all([notify(general, "PLAN_UPDATED", {}), notify(general, "PLAN_UPDATED", {})]);
  expect(await db.notification.count({ where: { userId: general, type: "PLAN_UPDATED" } })).toBe(before + 2);
});

test("opening marks read and goes to the target for the recipient's role", async () => {
  const coach = await userId("coach@demo.cz");
  const key = randomUUID();
  await notify(coach, "NEW_MESSAGE", { from: "Petr Novák", clientId: "c1" }, key);
  const { id } = await db.notification.findFirstOrThrow({ where: { userId: coach, key } });

  await as("coach@demo.cz");
  await expect(openNotification(withId(id))).rejects.toMatchObject(redirectsTo("/coach/messages?client=c1"));
  expect((await db.notification.findUniqueOrThrow({ where: { id } })).readAt).toBeInstanceOf(Date);
});

test("a user can't open or mark another user's notification; mark all read touches only their own", async () => {
  const sports = await userId("sports@demo.cz");
  const coach = await userId("coach@demo.cz");
  const key = randomUUID();
  await notify(sports, "PLAN_UPDATED", {}, key);
  await notify(coach, "CHECK_IN_SUBMITTED", { client: "Emma Walker", checkInId: "x" }, key);
  const theirs = await db.notification.findFirstOrThrow({ where: { userId: sports, key } });

  await as("general@demo.cz");
  await expect(markRead(withId(theirs.id))).rejects.toMatchObject(notFound);
  await expect(openNotification(withId(theirs.id))).rejects.toMatchObject(notFound);
  await markAllRead();
  expect(await db.notification.count({ where: { key, readAt: null } })).toBe(2);
  expect(await db.notification.count({ where: { userId: await userId("general@demo.cz"), readAt: null } })).toBe(0);

  await as("sports@demo.cz");
  await markRead(withId(theirs.id));
  expect((await db.notification.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeInstanceOf(Date);
  expect(await db.notification.count({ where: { userId: coach, key, readAt: null } })).toBe(1);
});

test("every notification type has its text in both languages", () => {
  for (const type of NOTIFICATION_TYPES) {
    expect(cs.Notifications.types[type]).toBeTruthy();
    expect(en.Notifications.types[type]).toBeTruthy();
  }
});
