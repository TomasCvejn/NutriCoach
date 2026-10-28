import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { saveProfile } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("profile-coach"), name: "Profile Coach", role: "COACH" });
  const client = (name: string) => createUser({ email: uniqueEmail("profile-client"), name, role: "CLIENT", client: { create: { coachId: coach.id } } });
  const [anna, bara] = await Promise.all([client("Anna"), client("Bára")]);
  const id = async (user: { id: string }) => (await db.client.findUniqueOrThrow({ where: { userId: user.id } })).id;
  return { coach, anna: { ...anna, clientId: await id(anna) }, bara: { ...bara, clientId: await id(bara) } };
}

const personal = { section: "personal", name: "Anna Nová", sex: "FEMALE", birthDate: "1990-05-01", heightCm: "170", weightKg: "64.5", phone: "+420 777 123 456" };
const dietary = { section: "dietary", dietType: "VEGAN", allergens: ["SESAME", "GLUTEN", "SESAME"], allergiesNote: "", restrictions: "  " };

test("a client saves their own profile, one section at a time", async () => {
  const { anna } = await setup();
  await expect(saveProfile(null, form({ ...personal, clientId: anna.clientId }))).rejects.toMatchObject(redirectsTo("/login"));

  request.cookie = await signIn(anna.email);
  expect(await saveProfile(null, form({ ...personal, clientId: anna.clientId }))).toEqual({ saved: true });
  expect(await saveProfile(null, form({ ...dietary, clientId: anna.clientId }))).toEqual({ saved: true });
  const training = { section: "training", clientId: anna.clientId, sports: "Plavání", sportLevel: "", sessionsPerWeek: "0", sessionMinutes: "" };
  expect(await saveProfile(null, form(training))).toEqual({ saved: true });

  const saved = await db.client.findUniqueOrThrow({ where: { id: anna.clientId }, include: { user: { select: { name: true } } } });
  expect(saved).toMatchObject({ user: { name: "Anna Nová" }, sex: "FEMALE", heightCm: 170, weightKg: 64.5, phone: "+420 777 123 456" });
  // Checkboxes in ALLERGENS order without repeats; empty and blank text → null; a 0 stays 0.
  expect(saved).toMatchObject({ dietType: "VEGAN", allergens: ["GLUTEN", "SESAME"], allergiesNote: null, restrictions: null });
  expect(saved).toMatchObject({ sports: "Plavání", sportLevel: null, sessionsPerWeek: 0, sessionMinutes: null });
});

test("invalid values are rejected and nothing is written", async () => {
  const { anna } = await setup();
  request.cookie = await signIn(anna.email);
  const bad = { ...personal, clientId: anna.clientId, name: " ", sex: "X", birthDate: "2999-01-01", heightCm: "400", weightKg: "abc", phone: "call me" };
  expect(await saveProfile(null, form(bad))).toEqual({ invalid: ["name", "sex", "birthDate", "heightCm", "weightKg", "phone"] });
  expect(await saveProfile(null, form({ ...dietary, clientId: anna.clientId, allergens: ["PIZZA"] }))).toEqual({ invalid: ["allergens"] });
  expect(await saveProfile(null, form({ section: "goals", clientId: anna.clientId, primaryGoal: "", targetWeightKg: "", targetDate: "2026-02-30", successText: "" }))).toEqual({
    invalid: ["targetDate"],
  });
  await expect(saveProfile(null, form({ ...personal, clientId: anna.clientId, section: "secrets" }))).rejects.toThrow();
  expect(await db.client.findUniqueOrThrow({ where: { id: anna.clientId }, include: { user: true } })).toMatchObject({ user: { name: "Anna" }, sex: null, allergens: [] });
});

test("a client can't update another client's profile", async () => {
  const { anna, bara } = await setup();
  request.cookie = await signIn(anna.email);
  await expect(saveProfile(null, form({ ...personal, clientId: bara.clientId }))).rejects.toMatchObject(notFound);
  expect(await db.client.findUniqueOrThrow({ where: { id: bara.clientId }, include: { user: true } })).toMatchObject({ user: { name: "Bára" }, sex: null });
});

test("the coach edits their client's profile; another coach can't", async () => {
  const { coach, anna } = await setup();
  request.cookie = await signIn(coach.email);
  expect(await saveProfile(null, form({ ...dietary, clientId: anna.clientId }))).toEqual({ saved: true });

  const other = await createUser({ email: uniqueEmail("profile-other"), name: "Other Coach", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(saveProfile(null, form({ ...personal, clientId: anna.clientId }))).rejects.toMatchObject(notFound);
  expect(await db.client.findUniqueOrThrow({ where: { id: anna.clientId } })).toMatchObject({ dietType: "VEGAN", sex: null });
});
