import { expect, test, vi } from "vitest";
import { createInvite, revokeInvite } from "@/app/coach/clients/actions";
import { createUser, requireClient, acceptInvite } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleSignIn, notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

async function as(email: string) {
  request.cookie = await signIn(email);
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

// A pending invite of coach@demo.cz, created through the coach's action.
async function newInvite(fields: Partial<Record<"name" | "email" | "program" | "trackingMode", string>> = {}) {
  await as("coach@demo.cz");
  const state = await createInvite(null, form({ name: "Nový Klient", email: "", program: "", trackingMode: "", ...fields }));
  if (!state || !("token" in state)) throw new Error(`invite not created: ${JSON.stringify(state)}`);
  return db.invite.findUniqueOrThrow({ where: { token: state.token } });
}

const choices = (token: string, email: string) => ({ token, email, timezone: "America/New_York", locale: "en" });

test("coach creates an invite: random 256-bit token, 7 days, empty optional fields stay empty; invalid input is refused", async () => {
  const before = Date.now();
  const invite = await newInvite({ name: "  Klára  ", email: " Klara@Test.CZ " });
  expect(invite).toMatchObject({ name: "Klára", email: "klara@test.cz", program: null, trackingMode: null, usedAt: null, revokedAt: null });
  expect(invite.token).toMatch(/^[\w-]{43}$/);
  expect(invite.expiresAt.getTime() - before).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  expect(invite.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  expect((await newInvite()).token).not.toBe(invite.token);

  const count = await db.invite.count();
  const refused = await createInvite(null, form({ name: " ", email: "not-an-email", program: "YOGA", trackingMode: "" }));
  expect(refused).toEqual({ invalid: ["name", "email", "program"] });
  expect(await db.invite.count()).toBe(count);
});

test("a client can't create invites", async () => {
  await as("general@demo.cz");
  await expect(createInvite(null, form({ name: "X", email: "", program: "", trackingMode: "" }))).rejects.toMatchObject(redirectsTo("/app"));
});

test("accepting creates the client user and Client in one go, with the invite's program / mode and the client's choices", async () => {
  const email = uniqueEmail("accept");
  const invite = await newInvite({ name: "Klára Dvořáková", email, program: "SPORTS", trackingMode: "PORTIONS" });
  expect(await acceptInvite(choices(invite.token, email.toUpperCase()))).toBeNull();

  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { client: { include: { invite: true } } } });
  expect(user).toMatchObject({ name: "Klára Dvořáková", role: "CLIENT", active: true, timezone: "America/New_York", locale: "en" });
  expect(user.client).toMatchObject({ coachId: invite.coachId, program: "SPORTS", trackingMode: "PORTIONS", invite: { id: invite.id } });
  expect(user.client?.invite?.usedAt).toBeInstanceOf(Date);

  // Without program / mode the client gets the defaults until onboarding.
  const open = await newInvite();
  const other = uniqueEmail("defaults");
  expect(await acceptInvite(choices(open.token, other))).toBeNull();
  expect(await db.client.findFirstOrThrow({ where: { user: { email: other } } })).toMatchObject({ program: "GENERAL", trackingMode: "CALORIES" });
});

test("expired, used, revoked and unknown tokens are rejected and create nothing", async () => {
  const expired = await newInvite();
  await db.invite.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const used = await newInvite();
  expect(await acceptInvite(choices(used.token, uniqueEmail("first")))).toBeNull();
  const revoked = await newInvite();
  await revokeInvite(form({ id: revoked.id }));

  for (const token of [expired.token, used.token, revoked.token, "no-such-token"]) {
    const email = uniqueEmail("rejected");
    expect(await acceptInvite(choices(token, email))).toBe("unavailable");
    expect(await db.user.count({ where: { email } })).toBe(0);
  }
});

test("bad choices are refused before anything happens", async () => {
  const invite = await newInvite();
  const email = uniqueEmail("bad");
  expect(await acceptInvite({ ...choices(invite.token, email), timezone: "Mars/Olympus" })).toBe("failed");
  expect(await acceptInvite({ ...choices(invite.token, email), locale: "de" })).toBe("failed");
  expect(await acceptInvite({ ...choices(invite.token, email), email: "nope" })).toBe("failed");
  expect(await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).toMatchObject({ usedAt: null });
});

test("an invite with an email only accepts that email; a taken email is rejected; both leave the invite pending", async () => {
  const invite = await newInvite({ email: uniqueEmail("invited") });
  expect(await acceptInvite(choices(invite.token, uniqueEmail("someone-else")))).toBe("email_mismatch");

  const open = await newInvite();
  expect(await acceptInvite(choices(open.token, "sports@demo.cz"))).toBe("email_taken");
  expect(await db.client.count({ where: { user: { email: "sports@demo.cz" } } })).toBe(1);

  const pending = await db.invite.findMany({ where: { id: { in: [invite.id, open.id] } } });
  expect(pending.map((i) => i.usedAt)).toEqual([null, null]);
});

test("two concurrent accepts of one invite create one user", async () => {
  const invite = await newInvite();
  const emails = [uniqueEmail("race-a"), uniqueEmail("race-b")];
  const results = await Promise.all(emails.map((email) => acceptInvite(choices(invite.token, email))));
  expect(results.sort()).toEqual([null, "unavailable"].sort());
  expect(await db.user.count({ where: { email: { in: emails } } })).toBe(1);
});

test("only the owning coach revokes, and only a pending invite", async () => {
  const invite = await newInvite();
  const other = await createUser({ email: uniqueEmail("other-coach"), name: "Other Coach", role: "COACH" });
  await as(other.email);
  await expect(revokeInvite(form({ id: invite.id }))).rejects.toMatchObject(notFound);
  expect(await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).toMatchObject({ revokedAt: null });

  await as("general@demo.cz");
  await expect(revokeInvite(form({ id: invite.id }))).rejects.toMatchObject(redirectsTo("/app"));

  await as("coach@demo.cz");
  await revokeInvite(form({ id: invite.id }));
  expect((await db.invite.findUniqueOrThrow({ where: { id: invite.id } })).revokedAt).toBeInstanceOf(Date);
  await expect(revokeInvite(form({ id: invite.id }))).rejects.toMatchObject(notFound);
});

test("Google acceptance: the invite rides the OAuth state, the user is created and Google linked, the client is signed in", async () => {
  const email = uniqueEmail("google");
  const invite = await newInvite({ email, program: "COMPETITION" });
  const start = { callbackURL: "/app", errorCallbackURL: `/invite/${invite.token}` };

  // The wrong Google account goes back to the invite page and creates nothing.
  const wrong = uniqueEmail("wrong");
  const refused = await googleSignIn(wrong, { ...start, additionalData: { invite: choices(invite.token, "") } });
  expect(refused).toEqual({ status: 302, location: `/invite/${invite.token}?error=email_mismatch`, session: "" });
  expect(await db.user.count({ where: { email: wrong } })).toBe(0);

  const res = await googleSignIn(email, { ...start, additionalData: { invite: { token: invite.token, timezone: "Europe/London", locale: "cs" } } });
  expect(res).toMatchObject({ status: 302, location: "/app", session: expect.stringContaining("session_token") });
  request.cookie = res.session;
  const { user, client } = await requireClient();
  expect(user).toMatchObject({ email, role: "CLIENT", timezone: "Europe/London", locale: "cs" });
  expect(client).toMatchObject({ program: "COMPETITION", coachId: invite.coachId });
  expect(await db.account.findMany({ where: { userId: user.id } })).toMatchObject([{ providerId: "google", accountId: `g-${email}` }]);

  // The link is spent: a second round trip with it is refused (the user is already there).
  expect(await googleSignIn(email, { ...start, additionalData: { invite: choices(invite.token, "") } })).toMatchObject({
    location: `/invite/${invite.token}?error=unavailable`,
    session: "",
  });
});
