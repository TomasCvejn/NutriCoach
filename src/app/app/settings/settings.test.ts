import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { saveSettings, saveWelcomeText } from "./actions";

const request = vi.hoisted(() => ({ cookie: "", setCookie: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: request.cookie }),
  cookies: async () => ({ set: request.setCookie }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

test("a user saves their own language and time zone; an unknown zone or language is rejected", async () => {
  const { id, email } = await createUser({ email: uniqueEmail("settings"), name: "Settings Coach", role: "COACH" });
  const saved = () => db.user.findUniqueOrThrow({ where: { id }, select: { locale: true, timezone: true } });

  await expect(saveSettings(form({ locale: "en", timezone: "America/New_York" }))).rejects.toMatchObject(redirectsTo("/login"));

  request.cookie = await signIn(email);
  await expect(saveSettings(form({ locale: "en", timezone: "Mars/Olympus" }))).rejects.toThrow();
  await expect(saveSettings(form({ locale: "en", timezone: "" }))).rejects.toThrow();
  await expect(saveSettings(form({ locale: "de", timezone: "America/New_York" }))).rejects.toThrow();
  expect(await saved()).toEqual({ locale: "cs", timezone: "Europe/Prague" });

  await saveSettings(form({ locale: "en", timezone: "America/New_York" }));
  expect(await saved()).toEqual({ locale: "en", timezone: "America/New_York" });
  // The logged-out pages follow the language too.
  expect(request.setCookie).toHaveBeenCalledWith("locale", "en", expect.anything());
});

test("only a coach saves the onboarding welcome text; blank clears it, too long is rejected", async () => {
  const coach = await createUser({ email: uniqueEmail("welcome-coach"), name: "Welcome Coach", role: "COACH" });
  const client = await createUser({ email: uniqueEmail("welcome-client"), name: "Welcome Client", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const saved = async () => (await db.user.findUniqueOrThrow({ where: { id: coach.id } })).welcomeText;

  request.cookie = "";
  await expect(saveWelcomeText(form({ welcomeText: "Hi" }))).rejects.toMatchObject(redirectsTo("/login"));
  request.cookie = await signIn(client.email);
  await expect(saveWelcomeText(form({ welcomeText: "Hi" }))).rejects.toMatchObject(redirectsTo("/app"));

  request.cookie = await signIn(coach.email);
  await saveWelcomeText(form({ welcomeText: "  Vítejte!\nTěším se.  " }));
  expect(await saved()).toBe("Vítejte!\nTěším se.");
  await expect(saveWelcomeText(form({ welcomeText: "x".repeat(2001) }))).rejects.toThrow();
  expect(await saved()).toBe("Vítejte!\nTěším se.");
  await saveWelcomeText(form({ welcomeText: "   " }));
  expect(await saved()).toBeNull();
  expect(await db.user.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ welcomeText: null });
});
