import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import { auth, createUser, requireClient, requireCoach, requireCoachOf, requireUser } from "./auth";
import { db } from "./db";

// The helpers read the session cookie through next/headers; tests swap the cookie per "request".
const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));

const post = (path: string, body: object, cookie = "") =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
  );

async function signIn(email: string, password = "demo1234") {
  const res = await post("/sign-in/email", { email, password });
  expect(res.status).toBe(200);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function as(email: string, password?: string) {
  request.cookie = await signIn(email, password);
}

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@test.cz`;
// redirect() / notFound() throw errors whose digest carries the target.
const redirectsTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) });
const notFound = { digest: expect.stringContaining("404") };

test("CLI-created coach can sign in; invalid CLI input is rejected", { timeout: 30_000 }, async () => {
  const email = uniqueEmail("cli");
  const cli = (...args: string[]) => execFileSync("npx", ["tsx", "scripts/coach-create.ts", ...args], { stdio: "pipe" });
  cli("--email", email.toUpperCase(), "--name", "CLI Coach", "--password", "secret123");
  expect(() => cli("--email", "not-an-email", "--name", "X", "--password", "short")).toThrow(/email[\s\S]*password/);

  await as(email, "secret123");
  expect(await requireCoach()).toMatchObject({ email, role: "COACH", timezone: "Europe/Prague", locale: "cs" });
});

test("public sign-up is refused", async () => {
  const email = uniqueEmail("signup");
  const res = await post("/sign-up/email", { email, password: "secret123", name: "Stranger" });
  expect(res.status).toBe(400);
  expect(await db.user.count({ where: { email } })).toBe(0);
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

  const other = await createUser({ email: uniqueEmail("other"), name: "Other Coach", password: "secret123", role: "COACH" });
  await as(other.email, "secret123");
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
  const email = uniqueEmail("inactive");
  const user = await createUser({ email, name: "Inactive", password: "secret123", role: "CLIENT", client: { create: { coachId: coach.id } } });
  await as(email, "secret123");
  expect((await requireClient()).user.id).toBe(user.id);

  await db.user.update({ where: { id: user.id }, data: { active: false } });
  await expect(requireUser()).rejects.toMatchObject(redirectsTo("/login"));
  await expect(requireClient()).rejects.toMatchObject(redirectsTo("/login"));
});
