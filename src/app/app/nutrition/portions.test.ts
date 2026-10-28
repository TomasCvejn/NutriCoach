import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { portionsAdherence } from "@/lib/nutrition";
import { redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { setPortion } from "./portion-actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const at = { date: "2026-10-20", slot: "Snídaně" };

async function client() {
  const coach = await createUser({ email: uniqueEmail("portions-coach"), name: "Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("portions-client"), name: "Petra", role: "CLIENT", client: { create: { coachId: coach.id, trackingMode: "PORTIONS" } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}
const rows = (clientId: string) => db.portionLog.findMany({ where: { clientId }, orderBy: { slot: "asc" } });

test("counts per meal in half portions; a meal back at zero has no row, so the day reads as not logged", async () => {
  const { user, client: c } = await client();
  request.cookie = await signIn(user.email);
  expect(await setPortion(form({ ...at, kind: "palms", value: "1" }))).toBeNull();
  expect(await setPortion(form({ ...at, kind: "hands", value: "1.5" }))).toBeNull();
  expect(await setPortion(form({ ...at, slot: "Oběd", kind: "palms", value: "2" }))).toBeNull();
  expect(await rows(c.id)).toMatchObject([
    { slot: "Oběd", palms: 2, hands: 0 },
    { slot: "Snídaně", palms: 1, hands: 1.5, fists: 0, thumbs: 0 },
  ]);
  const target = { palms: 4, hands: 2, fists: null, thumbs: null };
  expect(portionsAdherence(await rows(c.id), target)).toBe("ADHERENT"); // 3 palms, 1.5 hands: both within ±1

  await setPortion(form({ ...at, slot: "Oběd", kind: "palms", value: "0" }));
  await setPortion(form({ ...at, kind: "palms", value: "0" }));
  await setPortion(form({ ...at, kind: "hands", value: "0" }));
  expect(await rows(c.id)).toEqual([]);
  expect(portionsAdherence(await rows(c.id), target)).toBe("NOT_LOGGED");
});

test("non-half, negative or huge counts and unknown kinds are refused; a coach can't count for the client", async () => {
  const { coach, user, client: c } = await client();
  request.cookie = await signIn(user.email);
  for (const [kind, value] of [["palms", "0.3"], ["palms", "-0.5"], ["fists", "20.5"], ["spoons", "1"]]) {
    expect(await setPortion(form({ ...at, kind, value }))).toMatchObject({ invalid: [expect.any(String)] });
  }
  expect(await setPortion(form({ ...at, slot: " ", kind: "palms", value: "1" }))).toEqual({ invalid: ["slot"] });
  request.cookie = await signIn(coach.email);
  await expect(setPortion(form({ ...at, kind: "palms", value: "1" }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await rows(c.id)).toEqual([]);
});
