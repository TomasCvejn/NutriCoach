import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Followed } from "@/lib/enums";
import { guidanceAdherence } from "@/lib/nutrition";
import { redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { saveGuidance } from "./guidance-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const day = { date: "2026-10-20" };

async function client() {
  const coach = await createUser({ email: uniqueEmail("guidance-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("guidance-client"), name: "Gita", role: "CLIENT", client: { create: { coachId: coach.id, trackingMode: "GUIDANCE" } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const rows = (clientId: string) => db.guidanceLog.findMany({ where: { clientId }, orderBy: { slot: "asc" } });

test("marking meals followed, partly or not, with a note; clearing both removes the row", async () => {
  const { user, client: c } = await client();
  request.cookie = await signIn(user.email);
  expect(await saveGuidance(form({ ...day, slot: "Oběd", followed: "PARTLY", note: " Polévka navíc " }))).toBeNull();
  expect(await saveGuidance(form({ ...day, slot: "Snídaně", followed: "YES", note: "" }))).toBeNull();
  expect(await saveGuidance(form({ ...day, slot: "Večeře", followed: "", note: "Večeře venku" }))).toBeNull();
  expect(await rows(c.id)).toMatchObject([
    { slot: "Oběd", followed: "PARTLY", note: "Polévka navíc" },
    { slot: "Snídaně", followed: "YES", note: null },
    { slot: "Večeře", followed: null, note: "Večeře venku" },
  ]);
  // Four planned meals: 1 + ½ of 4 is not enough; the unmarked dinner counts as not followed.
  const marks = (await rows(c.id)).flatMap((r) => (r.followed ? [r.followed as Followed] : []));
  expect(guidanceAdherence(marks, 4)).toBe("MISSED");

  await saveGuidance(form({ ...day, slot: "Večeře", followed: "", note: "" }));
  expect((await rows(c.id)).map((r) => r.slot)).toEqual(["Oběd", "Snídaně"]);
});

test("unknown answers are refused; a coach can't mark the client's meals", async () => {
  const { coach, user, client: c } = await client();
  request.cookie = await signIn(user.email);
  expect(await saveGuidance(form({ ...day, slot: "Oběd", followed: "MAYBE", note: "" }))).toEqual({ invalid: ["followed"] });
  expect(await saveGuidance(form({ date: "2026-02-30", slot: "Oběd", followed: "YES", note: "" }))).toEqual({ invalid: ["date"] });
  request.cookie = await signIn(coach.email);
  await expect(saveGuidance(form({ ...day, slot: "Oběd", followed: "YES", note: "" }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await rows(c.id)).toEqual([]);
});
