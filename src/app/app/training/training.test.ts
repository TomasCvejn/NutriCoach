import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteSession, saveSession } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("training-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("training-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const session = (clientId: string) => ({
  ...{ clientId, date: "2026-11-02", startTime: "06:30", type: "RUN", sport: "", durationMin: "60", intensity: "MODERATE" },
  ...{ description: "", rpe: "", felt: "", note: "", repeatUntil: "" },
});

test("repeat weekly creates one row per week up to the date; editing one leaves the others; the coach edits too", async () => {
  const { coach, user, client } = await setup();
  request.cookie = await signIn(user.email);
  expect(await saveSession(form({ ...session(client.id), repeatUntil: "2026-11-25", description: " Easy run " }))).toBeNull();
  const rows = await db.trainingSession.findMany({ where: { clientId: client.id }, orderBy: { date: "asc" } });
  expect(rows.map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  expect(rows[3]).toMatchObject({ startTime: "06:30", type: "RUN", durationMin: 60, intensity: "MODERATE", description: "Easy run", rpe: null });

  request.cookie = await signIn(coach.email);
  const edited = { ...session(client.id), id: rows[1].id, date: "2026-11-10", durationMin: "90", intensity: "HIGH", rpe: "7", felt: "8", note: "Strong" };
  expect(await saveSession(form(edited))).toBeNull();
  const after = await db.trainingSession.findMany({ where: { clientId: client.id }, orderBy: { date: "asc" } });
  expect(after.map((r) => [r.date, r.durationMin, r.rpe])).toEqual([
    ["2026-11-02", 60, null],
    ["2026-11-10", 90, 7],
    ["2026-11-16", 60, null],
    ["2026-11-23", 60, null],
  ]);
  await deleteSession(form({ clientId: client.id, id: rows[2].id }));
  expect(await db.trainingSession.count({ where: { clientId: client.id } })).toBe(3);
});

test("bad input is refused; another client or coach can't add, edit or delete", async () => {
  const { user, client } = await setup();
  request.cookie = await signIn(user.email);
  const bad = { ...session(client.id), startTime: "25:00", type: "YOGA", durationMin: "0", intensity: "EXTREME", rpe: "11", repeatUntil: "2026-10-01" };
  expect(await saveSession(form(bad))).toEqual({ invalid: ["startTime", "type", "durationMin", "intensity", "rpe"] });
  expect(await saveSession(form({ ...session(client.id), repeatUntil: "2026-10-01" }))).toEqual({ invalid: ["repeatUntil"] }); // before the date
  expect(await saveSession(form({ ...session(client.id), repeatUntil: "2028-01-01" }))).toEqual({ invalid: ["repeatUntil"] }); // over a year
  expect(await saveSession(form(session(client.id)))).toBeNull();
  const saved = await db.trainingSession.findFirstOrThrow({ where: { clientId: client.id } });

  const other = await setup();
  request.cookie = await signIn(other.user.email);
  await expect(saveSession(form(session(client.id)))).rejects.toMatchObject(notFound);
  await expect(saveSession(form({ ...session(other.client.id), id: saved.id }))).rejects.toMatchObject(notFound);
  await expect(deleteSession(form({ clientId: other.client.id, id: saved.id }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(other.coach.email);
  await expect(deleteSession(form({ clientId: client.id, id: saved.id }))).rejects.toMatchObject(notFound);
  request.cookie = "";
  await expect(saveSession(form(session(client.id)))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await db.trainingSession.findMany({ where: { clientId: client.id } })).toMatchObject([{ id: saved.id, durationMin: 60 }]);
});
