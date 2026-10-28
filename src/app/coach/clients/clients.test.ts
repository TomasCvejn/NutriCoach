import { expect, test, vi } from "vitest";
import { createUser, requireClient } from "@/lib/auth";
import { type ClientRow, clientList, coachClients, listParams } from "@/lib/client-list";
import { db } from "@/lib/db";
import { notFound, post, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { setClientActive } from "./actions";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const row = (name: string, trackingMode: string, status: ClientRow["status"], adherence: number | null = null, lastLogged: string | null = null): ClientRow => ({
  ...{ id: name, name, email: `${name}@x.cz`, trackingMode, status },
  ...{ adherence, lastLogged, daysAgo: null },
});
const rows = [row("Šárka", "PORTIONS", "ACTIVE"), row("anna", "CALORIES", "ONBOARDING"), row("Zdeněk", "GUIDANCE", "INACTIVE"), row("Bára", "CALORIES", "ACTIVE")];
const names = (list: { rows: ClientRow[] }) => list.rows.map((r) => r.name);

test("the default view: active and onboarding clients by name, with the count of every tab", () => {
  const list = clientList(rows, listParams.parse({}), "cs");
  expect(names(list)).toEqual(["anna", "Bára", "Šárka"]);
  expect(list.counts).toEqual({ active: 3, inactive: 1, all: 4 });
  expect(names(clientList(rows, listParams.parse({ status: "inactive" }), "cs"))).toEqual(["Zdeněk"]);
});

test("search ignores case and diacritics; the tab counts follow the search and the mode filter", () => {
  expect(clientList(rows, listParams.parse({ q: " SAR " }), "cs")).toMatchObject({ rows: [{ name: "Šárka" }], counts: { active: 1, inactive: 0, all: 1 } });
  expect(clientList(rows, listParams.parse({ status: "all", mode: "CALORIES" }), "cs")).toMatchObject({ counts: { active: 2, inactive: 0, all: 2 } });
});

test("sorting by mode or status keeps names in order within a group; desc reverses", () => {
  expect(names(clientList(rows, listParams.parse({ status: "all", sort: "status" }), "cs"))).toEqual(["anna", "Bára", "Šárka", "Zdeněk"]);
  expect(names(clientList(rows, listParams.parse({ status: "all", sort: "mode", dir: "desc" }), "cs"))).toEqual(["Zdeněk", "Šárka", "Bára", "anna"]);
  // The locale's collation: Czech puts "Ch" after "H".
  const ch = [row("Chvojka", "CALORIES", "ACTIVE"), row("Horák", "CALORIES", "ACTIVE")];
  expect(names(clientList(ch, listParams.parse({}), "cs"))).toEqual(["Horák", "Chvojka"]);
  expect(names(clientList(ch, listParams.parse({}), "en"))).toEqual(["Chvojka", "Horák"]);
});

test("sorting by last logged day or adherence puts never-logged / no-data clients lowest", () => {
  const list = [row("A", "CALORIES", "ACTIVE", 86, "2026-10-27"), row("B", "PORTIONS", "ACTIVE", null, null), row("C", "CALORIES", "ACTIVE", 40, "2026-10-20")];
  expect(names(clientList(list, listParams.parse({ sort: "adherence" }), "cs"))).toEqual(["B", "C", "A"]);
  expect(names(clientList(list, listParams.parse({ sort: "adherence", dir: "desc" }), "cs"))).toEqual(["A", "C", "B"]);
  expect(names(clientList(list, listParams.parse({ sort: "lastLogged" }), "cs"))).toEqual(["B", "C", "A"]);
});

test("unknown search params fall back to the default view", () => {
  expect(listParams.parse({ q: ["a", "b"], status: "deleted", mode: "YOGA", sort: "email", dir: "up" })).toEqual({ q: "", status: "active", sort: "name", dir: "asc" });
});

async function coachWithClient(prefix: string) {
  const coach = await createUser({ email: uniqueEmail(`${prefix}-coach`), name: "List Coach", role: "COACH" });
  const user = await createUser({ email: uniqueEmail(`${prefix}-client`), name: "List Client", role: "CLIENT", client: { create: { coachId: coach.id } } });
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }) };
}

test("a coach lists only their own clients", async () => {
  const other = await coachWithClient("list");
  request.cookie = await signIn("coach@demo.cz");
  const coach = await db.user.findUniqueOrThrow({ where: { email: "coach@demo.cz" } });
  const listed = await coachClients();
  expect(listed.map((c) => c.id).sort()).toEqual((await db.client.findMany({ where: { coachId: coach.id } })).map((c) => c.id).sort());
  expect(listed).toContainEqual(expect.objectContaining({ name: "Lucie Králová", status: "INACTIVE" }));
  expect(listed.map((c) => c.id)).not.toContain(other.client.id);

  request.cookie = await signIn(other.coach.email);
  expect(await coachClients()).toEqual([
    { id: other.client.id, name: "List Client", email: other.user.email, trackingMode: "CALORIES", status: "ONBOARDING", lastLogged: null, daysAgo: null, adherence: null },
  ]);

  request.cookie = await signIn("general@demo.cz");
  await expect(coachClients()).rejects.toMatchObject(redirectsTo("/app"));
});

test("deactivating ends the client's sessions and refuses sign-in; reactivating lets them back in", async () => {
  const { coach, user, client } = await coachWithClient("deactivate");
  const clientCookie = await signIn(user.email);

  request.cookie = await signIn(coach.email);
  await setClientActive(form({ clientId: client.id, active: "false" }));
  expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ active: false });
  expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  expect(await db.client.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ coachId: coach.id }); // data kept

  request.cookie = clientCookie;
  await expect(requireClient()).rejects.toMatchObject(redirectsTo("/login"));
  expect((await post("/dev-login", { email: user.email })).status).toBe(403);

  request.cookie = await signIn(coach.email);
  await setClientActive(form({ clientId: client.id, active: "true" }));
  request.cookie = await signIn(user.email);
  expect((await requireClient()).client.id).toBe(client.id);
});

test("another coach, a client and bad input can't change a client's status", async () => {
  const { client } = await coachWithClient("status-auth");
  const other = await createUser({ email: uniqueEmail("status-other"), name: "Other Coach", role: "COACH" });
  request.cookie = await signIn(other.email);
  await expect(setClientActive(form({ clientId: client.id, active: "false" }))).rejects.toMatchObject(notFound);

  request.cookie = await signIn("general@demo.cz");
  await expect(setClientActive(form({ clientId: client.id, active: "false" }))).rejects.toMatchObject(redirectsTo("/app"));

  request.cookie = "";
  await expect(setClientActive(form({ clientId: client.id, active: "false" }))).rejects.toMatchObject(redirectsTo("/login"));
  await expect(setClientActive(form({ clientId: client.id, active: "maybe" }))).rejects.toThrow();
  expect(await db.user.findFirstOrThrow({ where: { client: { id: client.id } } })).toMatchObject({ active: true });
});
