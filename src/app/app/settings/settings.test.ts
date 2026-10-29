import { expect, test, vi } from "vitest";
import { GET as exportData } from "@/app/api/export/route";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { deleteAccount, saveNotificationSettings, saveSettings, saveWelcomeText } from "./actions";

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

test("notification settings: an unticked type is muted and notify() writes nothing of it; ticking it again lets it through", async () => {
  const client = await createUser({ email: uniqueEmail("mute-client"), name: "Klára", role: "CLIENT", client: { create: { coachId: (await db.user.findFirstOrThrow({ where: { role: "COACH" } })).id } } });
  request.cookie = await signIn(client.email);
  const settings = new FormData();
  for (const type of ["NEW_MESSAGE", "CHECK_IN_DUE", "FEEDBACK_PUBLISHED", "CALL_SCHEDULED", "COMPETITION_PHASE_STARTED", "CLIENT_DELETED_ACCOUNT"]) settings.append("on", type); // PLAN_UPDATED off; a coach type is ignored
  await saveNotificationSettings(settings);
  expect(await db.user.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ mutedNotifications: ["PLAN_UPDATED"] });

  await notify(client.id, "PLAN_UPDATED", {});
  await notify(client.id, "CALL_SCHEDULED", { startsAt: "2026-11-02T17:00:00.000Z" });
  expect((await db.notification.findMany({ where: { userId: client.id } })).map((n) => n.type)).toEqual(["CALL_SCHEDULED"]);

  settings.append("on", "PLAN_UPDATED");
  await saveNotificationSettings(settings);
  await notify(client.id, "PLAN_UPDATED", {});
  expect(await db.notification.count({ where: { userId: client.id, type: "PLAN_UPDATED" } })).toBe(1);
});

// A client with some of everything: their own rows, a thread both ways, and the coach's private note and history on them.
async function clientWithData(prefix: string) {
  const coach = await createUser({ email: uniqueEmail(`${prefix}-coach`), name: "Data Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail(`${prefix}-client`), name: "Dana Datová", role: "CLIENT", client: { create: { coachId: coach.id, onboardingCompletedAt: new Date() } } });
  const { id: clientId } = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  const date = "2026-10-27";
  await db.foodEntry.create({ data: { clientId, date, slot: "Oběd", name: "Rýže", kcal: 500, protein: 10, carbs: 100, fat: 5 } });
  await db.fluidLog.create({ data: { clientId, date, ml: 500, drinkType: "WATER" } });
  await db.food.create({ data: { source: "CLIENT", ownerId: user.id, name: "Babiččin koláč", kcal: 300, protein: 5, carbs: 40, fat: 12 } });
  await db.message.createMany({ data: [{ clientId, senderId: user.id, text: "Ahoj" }, { clientId, senderId: coach.id, text: "Dobrý den" }] });
  await db.coachNote.create({ data: { clientId, date, type: "NOTE", text: "Soukromá poznámka trenéra" } });
  await db.historyEvent.create({ data: { clientId, date, type: "PLAN", payload: { secret: "Historie trenéra" } } });
  await notify(user.id, "PLAN_UPDATED", {});
  return { coach, user, clientId };
}

test("export: only the client downloads their data as a JSON file, food log and thread in, the coach's notes and history out", async () => {
  const { coach, user } = await clientWithData("export");
  request.cookie = await signIn(coach.email);
  await expect(exportData()).rejects.toMatchObject(redirectsTo("/coach"));

  request.cookie = await signIn(user.email);
  const res = await exportData();
  expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
  const data = await res.json();
  expect(data.account).toMatchObject({ name: "Dana Datová", email: user.email, foods: [{ name: "Babiččin koláč" }], notifications: [{ type: "PLAN_UPDATED" }] });
  expect(data.foodEntries).toMatchObject([{ name: "Rýže", kcal: 500 }]);
  expect(data.fluidLogs).toMatchObject([{ ml: 500 }]);
  expect(data.messages.map((m: { text: string }) => m.text).sort()).toEqual(["Ahoj", "Dobrý den"]);
  expect(JSON.stringify(data)).not.toMatch(/Soukromá poznámka|Historie trenéra/);
});

// Every row pointing at the client or their user in any table (columns clientId / userId / senderId / ownerId), and the
// two rows themselves.
async function rowsOf(userId: string, clientId: string) {
  const columns = await db.$queryRaw<{ name: string; column: string }[]>`
    SELECT m.name, p.name AS "column" FROM sqlite_master m JOIN pragma_table_info(m.name) p
    WHERE m.type = 'table' AND p.name IN ('id', 'clientId', 'userId', 'senderId', 'ownerId')`;
  let rows = 0;
  for (const { name, column } of columns) {
    const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${name}" WHERE "${column}" IN (?, ?)`, userId, clientId);
    rows += Number(n);
  }
  return rows;
}

test("deleting the account takes the exact word of the user's language, then removes every row of the client and tells the coach", async () => {
  const { coach, user, clientId } = await clientWithData("delete");
  request.cookie = await signIn(user.email);
  const before = await rowsOf(user.id, clientId);
  expect(before).toBeGreaterThanOrEqual(12);

  await deleteAccount(form({ confirm: "smazat" }));
  await deleteAccount(form({ confirm: "DELETE" })); // the English word; the client's language is Czech
  expect(await rowsOf(user.id, clientId)).toBe(before);

  await expect(deleteAccount(form({ confirm: "SMAZAT" }))).rejects.toMatchObject(redirectsTo("/login"));
  expect(await rowsOf(user.id, clientId)).toBe(0);
  expect(await db.notification.findMany({ where: { userId: coach.id } })).toMatchObject([{ type: "CLIENT_DELETED_ACCOUNT", payload: { client: "Dana Datová" } }]);
  await expect(exportData()).rejects.toMatchObject(redirectsTo("/login")); // the cookie left behind signs no one in
});
