import { execFileSync } from "node:child_process";
import { expect, test, vi } from "vitest";
import { cookiesOf, googleSignIn, notFound, post, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import { createUser, requireClient, requireCoach, requireCoachOf, requireUser } from "./auth";
import { db } from "./db";

// The helpers read the session cookie through next/headers; tests swap the cookie per "request".
const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));

async function as(email: string) {
  request.cookie = await signIn(email);
}

test("CLI-created coach signs in with Google, which links the account; invalid CLI input is rejected", { timeout: 30_000 }, async () => {
  const email = uniqueEmail("cli");
  const cli = (...args: string[]) => execFileSync("npx", ["tsx", "scripts/coach-create.ts", ...args], { stdio: "pipe" });
  cli("--email", email.toUpperCase(), "--name", "CLI Coach");
  expect(() => cli("--email", "not-an-email", "--name", "")).toThrow(/email[\s\S]*name/);

  const res = await googleSignIn(email);
  expect(res).toMatchObject({ status: 302, location: "/", session: expect.stringContaining("session_token") });
  request.cookie = res.session;
  const coach = await requireCoach();
  expect(coach).toMatchObject({ email, name: "CLI Coach", role: "COACH", timezone: "Europe/Prague", locale: "cs" });
  expect(await db.account.findMany({ where: { userId: coach.id } })).toMatchObject([{ providerId: "google", accountId: `g-${email}` }]);

  // The second sign-in reuses the linked account.
  expect(await googleSignIn(email)).toMatchObject({ status: 302, location: "/" });
  expect(await db.account.count({ where: { userId: coach.id } })).toBe(1);
});

test("an unknown Google email creates nothing and lands on the no-account message", async () => {
  const email = uniqueEmail("stranger");
  expect(await googleSignIn(email)).toMatchObject({ status: 302, location: expect.stringMatching(/^\/login\?error=signup_disabled\b/), session: "" });
  expect(await db.user.count({ where: { email } })).toBe(0);
  expect(await db.account.count({ where: { accountId: `g-${email}` } })).toBe(0);
});

test("no passwords: email sign-in and sign-up are off, no credential account exists", async () => {
  expect((await post("/sign-in/email", { email: "coach@demo.cz", password: "demo1234" })).ok).toBe(false);
  const email = uniqueEmail("signup");
  expect((await post("/sign-up/email", { email, password: "secret123", name: "Stranger" })).ok).toBe(false);
  expect(await db.user.count({ where: { email } })).toBe(0);
  expect(await db.account.count({ where: { OR: [{ providerId: "credential" }, { password: { not: null } }] } })).toBe(0);
});

test("dev login is refused in production", async () => {
  const before = await db.session.count();
  vi.stubEnv("NODE_ENV", "production");
  try {
    const res = await post("/dev-login", { email: "coach@demo.cz" });
    expect(res.status).toBe(404);
    expect(cookiesOf(res)).toBe("");
  } finally {
    vi.unstubAllEnvs();
  }
  expect(await db.session.count()).toBe(before);
});

test("an inactive user can't sign in, neither by dev login nor by Google", async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: "inactive@demo.cz" } });
  expect(user.active).toBe(false);

  const res = await post("/dev-login", { email: user.email });
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ code: "ACCOUNT_INACTIVE" });
  expect(cookiesOf(res)).toBe("");

  expect(await googleSignIn(user.email)).toMatchObject({ status: 302, location: expect.stringMatching(/^\/login\?error=ACCOUNT_INACTIVE\b/), session: "" });
  expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
});

test("users can't change their role or active flag through Better Auth", async () => {
  const cookie = await signIn("general@demo.cz");
  expect((await post("/update-user", { role: "COACH" }, cookie)).status).toBe(400);
  expect((await post("/update-user", { active: false }, cookie)).status).toBe(400);
  expect(await db.user.findUniqueOrThrow({ where: { email: "general@demo.cz" } })).toMatchObject({ role: "CLIENT", active: true });
});

test("no session → login", async () => {
  request.cookie = "";
  await expect(requireUser()).rejects.toMatchObject(redirectsTo("/login"));
});

test("requireCoachOf rejects another coach's client", async () => {
  const general = await db.client.findFirstOrThrow({ where: { user: { email: "general@demo.cz" } } });
  await as("coach@demo.cz");
  expect((await requireCoachOf(general.id)).client.id).toBe(general.id);

  const other = await createUser({ email: uniqueEmail("other"), name: "Other Coach", role: "COACH" });
  await as(other.email);
  await expect(requireCoachOf(general.id)).rejects.toMatchObject(notFound);
});

test("requireCoach rejects a client, requireClient rejects a coach", async () => {
  await as("sports@demo.cz");
  expect((await requireClient()).client).toMatchObject({ program: "SPORTS", trackingMode: "CALORIES" });
  await expect(requireCoach()).rejects.toMatchObject(redirectsTo("/app"));
  await expect(requireCoachOf((await requireClient()).client.id)).rejects.toMatchObject(redirectsTo("/app"));

  await as("coach@demo.cz");
  await expect(requireClient()).rejects.toMatchObject(redirectsTo("/coach"));
});

test("an inactive client is rejected even with a live session", async () => {
  const coach = await db.user.findUniqueOrThrow({ where: { email: "coach@demo.cz" } });
  const user = await createUser({ email: uniqueEmail("inactive"), name: "Inactive", role: "CLIENT", client: { create: { coachId: coach.id } } });
  await as(user.email);
  expect((await requireClient()).user.id).toBe(user.id);

  await db.user.update({ where: { id: user.id }, data: { active: false } });
  await expect(requireUser()).rejects.toMatchObject(redirectsTo("/login"));
  await expect(requireClient()).rejects.toMatchObject(redirectsTo("/login"));
});
