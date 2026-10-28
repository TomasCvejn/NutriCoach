import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { changeTrackingMode } from "./actions";
import ClientLayout from "./layout";
import ClientOverview from "./page";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("dashboard-coach"), name: "Dashboard Coach", role: "COACH" });
  const user = await createUser({
    email: uniqueEmail("dashboard-client"),
    name: "Dana",
    role: "CLIENT",
    timezone: "Pacific/Kiritimati",
    client: { create: { coachId: coach.id, allergens: ["GLUTEN"], primaryGoal: "PERFORMANCE" } },
  });
  return { coach, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}

const history = (clientId: string) => db.historyEvent.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });

test("changing the tracking mode keeps the client's data and writes one history row per real change", async () => {
  const { coach, client } = await setup();
  request.cookie = await signIn(coach.email);
  await changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" }));
  await changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" })); // no change, no row
  await changeTrackingMode(form({ clientId: client.id, trackingMode: "CALORIES" }));

  expect(await db.client.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ trackingMode: "CALORIES", allergens: ["GLUTEN"], primaryGoal: "PERFORMANCE" });
  // The date is the client's day (UTC+14 here), not the server's.
  const date = todayIn("Pacific/Kiritimati");
  expect(await history(client.id)).toMatchObject([
    { type: "TRACKING_MODE", date, payload: { from: "CALORIES", to: "PORTIONS" } },
    { type: "TRACKING_MODE", date, payload: { from: "PORTIONS", to: "CALORIES" } },
  ]);
});

test("another coach, the client and bad input can't change the mode or open the dashboard", async () => {
  const { client } = await setup();
  const other = await createUser({ email: uniqueEmail("dashboard-other"), name: "Other Coach", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" }))).rejects.toMatchObject(notFound);
  const params = Promise.resolve({ id: client.id });
  await expect(ClientLayout({ params, children: null })).rejects.toMatchObject(notFound);
  await expect(ClientOverview({ params, searchParams: Promise.resolve({}) })).rejects.toMatchObject(notFound);

  request.cookie = await signIn((await db.user.findUniqueOrThrow({ where: { id: client.userId } })).email);
  await expect(changeTrackingMode(form({ clientId: client.id, trackingMode: "PORTIONS" }))).rejects.toMatchObject(redirectsTo("/app"));

  request.cookie = await signIn((await db.user.findUniqueOrThrow({ where: { id: client.coachId } })).email);
  await expect(changeTrackingMode(form({ clientId: client.id, trackingMode: "KETO" }))).rejects.toThrow();
  expect(await db.client.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ trackingMode: "CALORIES" });
  expect(await history(client.id)).toEqual([]);
});
