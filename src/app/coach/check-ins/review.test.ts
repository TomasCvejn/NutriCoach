import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES } from "@/lib/enums";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { publishFeedback } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

// A coach with one client who has sent a check-in, waiting for review.
async function setup() {
  const coach = await createUser({ email: uniqueEmail("review-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("review-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const client = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  const answers = Object.fromEntries(CHECK_IN_SCALES.map((s) => [s, { score: 7, comment: null }]));
  const checkIn = await db.checkIn.create({ data: { clientId: client.id, dueDate: "2026-10-26", answers } });
  return { coach, user, checkIn };
}

test("publishing feedback: stored, reviewed, the client told once, then to the queue; a second publish changes nothing", async () => {
  const { coach, user, checkIn } = await setup();
  request.cookie = await signIn(coach.email);
  const feedback = { checkInId: checkIn.id, response: " Skvělý týden. ", changes: "", newGoals: "3 l vody denně", nextSteps: "" };
  await expect(publishFeedback(null, form(feedback))).rejects.toMatchObject(redirectsTo("/coach/check-ins"));
  const reviewed = await db.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } });
  expect(reviewed).toMatchObject({ response: "Skvělý týden.", changes: null, newGoals: "3 l vody denně", nextSteps: null, reviewedAt: expect.any(Date) });
  expect(await db.notification.findMany({ where: { userId: user.id } })).toMatchObject([{ type: "FEEDBACK_PUBLISHED", payload: { checkInId: checkIn.id } }]);

  await expect(publishFeedback(null, form({ ...feedback, response: "Jinak" }))).rejects.toMatchObject(redirectsTo("/coach/check-ins"));
  expect(await db.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })).toMatchObject({ response: "Skvělý týden.", reviewedAt: reviewed.reviewedAt });
  expect(await db.notification.count({ where: { userId: user.id } })).toBe(1);
});

test("the response is required; another coach, the client and a missing check-in can't publish", async () => {
  const { coach, user, checkIn } = await setup();
  const valid = { checkInId: checkIn.id, response: "Dobře", changes: "", newGoals: "", nextSteps: "" };
  request.cookie = await signIn(coach.email);
  expect(await publishFeedback(null, form({ ...valid, response: "  ", nextSteps: "x".repeat(5001) }))).toEqual({ invalid: ["response", "nextSteps"] });
  await expect(publishFeedback(null, form({ ...valid, checkInId: "missing" }))).rejects.toMatchObject(notFound);

  const other = await createUser({ email: uniqueEmail("review-other"), name: "Other Coach", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(publishFeedback(null, form(valid))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(user.email);
  await expect(publishFeedback(null, form(valid))).rejects.toMatchObject(redirectsTo("/app"));
  expect(await db.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })).toMatchObject({ reviewedAt: null, response: null });
});
