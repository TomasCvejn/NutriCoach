import { expect, test, vi } from "vitest";
import ClientDailyLog from "@/app/coach/clients/[id]/nutrition/log/page";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { saveDayNote, setDayType } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("day-coach"), name: "Day Coach", role: "COACH" });
  const client = async (name: string) => {
    const user = await createUser({ email: uniqueEmail("day-client"), name, role: "CLIENT", client: { create: { coachId: coach.id } } });
    return { user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
  };
  return { coach, anna: await client("Anna"), bara: await client("Bára") };
}
const dayOf = (clientId: string, date = "2026-10-20") => db.nutritionDay.findUnique({ where: { clientId_date: { clientId, date } } });

test("the client and their coach set or clear a day's type; the note is the client's", async () => {
  const { coach, anna } = await setup();
  request.cookie = await signIn(anna.user.email);
  await setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "TRAINING" }));
  expect(await dayOf(anna.client.id)).toMatchObject({ dayTypeOverride: "TRAINING", note: null });
  expect(await saveDayNote(null, form({ clientId: anna.client.id, date: "2026-10-20", note: " Hodně hladu večer " }))).toEqual({ saved: true });
  expect(await dayOf(anna.client.id)).toMatchObject({ dayTypeOverride: "TRAINING", note: "Hodně hladu večer" });

  request.cookie = await signIn(coach.email);
  await setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "COMPETITION" }));
  await setDayType(form({ clientId: anna.client.id, date: "2026-10-21", dayType: "REST" }));
  await setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "" })); // back to automatic
  expect(await dayOf(anna.client.id)).toMatchObject({ dayTypeOverride: null, note: "Hodně hladu večer" });
  expect(await dayOf(anna.client.id, "2026-10-21")).toMatchObject({ dayTypeOverride: "REST" });
  // The coach reads the note but can't write it.
  await expect(saveDayNote(null, form({ clientId: anna.client.id, date: "2026-10-20", note: "x" }))).rejects.toMatchObject(redirectsTo("/coach"));
});

test("another client, another coach and bad input can't touch a client's day", async () => {
  const { anna, bara } = await setup();
  request.cookie = await signIn(bara.user.email);
  await expect(setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "TRAINING" }))).rejects.toMatchObject(notFound);
  await expect(saveDayNote(null, form({ clientId: anna.client.id, date: "2026-10-20", note: "x" }))).rejects.toMatchObject(notFound);
  await expect(setDayType(form({ clientId: bara.client.id, date: "2026-02-30", dayType: "TRAINING" }))).rejects.toThrow();
  await expect(setDayType(form({ clientId: bara.client.id, date: "2026-10-20", dayType: "HOLIDAY" }))).rejects.toThrow();

  const other = await createUser({ email: uniqueEmail("day-other"), name: "Other Coach", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "TRAINING" }))).rejects.toMatchObject(notFound);
  await expect(ClientDailyLog({ params: Promise.resolve({ id: anna.client.id }), searchParams: Promise.resolve({}) })).rejects.toMatchObject(notFound);

  request.cookie = "";
  await expect(setDayType(form({ clientId: anna.client.id, date: "2026-10-20", dayType: "TRAINING" }))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await dayOf(anna.client.id)).toBeNull();
  expect(await dayOf(bara.client.id)).toBeNull();
});
