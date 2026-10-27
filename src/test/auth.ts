import { randomUUID } from "node:crypto";
import { expect, vi } from "vitest";
import { auth } from "@/lib/auth";

// Helpers for integration tests. The auth helpers read the session cookie through next/headers, which each test file
// mocks with a hoisted { cookie } it sets from signIn() (see src/lib/auth.test.ts).

const url = (path: string) => `http://localhost:3000/api/auth${path}`;
export const post = (path: string, body: object, cookie = "") =>
  auth.handler(new Request(url(path), { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }));
export const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

export async function signIn(email: string) {
  const res = await post("/dev-login", { email });
  expect(res.status).toBe(200);
  return cookiesOf(res);
}

// The whole Google round trip without the network: Better Auth exchanges the code at Google's token endpoint (mocked)
// and reads the user from the id_token in that answer. `start` extends the /sign-in/social body.
// Returns the callback's redirect and the session cookie ("" = none).
export async function googleSignIn(email: string, start: object = {}) {
  const begin = await post("/sign-in/social", { provider: "google", callbackURL: "/", ...start });
  const state = new URL((await begin.json()).url).searchParams.get("state");
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const idToken = `${b64({ alg: "RS256" })}.${b64({ sub: `g-${email}`, email, email_verified: true, name: "From Google" })}.sig`;
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ access_token: "a", id_token: idToken, token_type: "Bearer" }));
  try {
    const res = await auth.handler(new Request(url(`/callback/google?code=c&state=${state}`), { headers: { cookie: cookiesOf(begin) } }));
    expect(fetch).toHaveBeenCalledOnce();
    const session = res.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="))?.split(";")[0] ?? "";
    return { status: res.status, location: res.headers.get("location"), session };
  } finally {
    fetch.mockRestore();
  }
}

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@test.cz`;
// redirect() / notFound() throw errors whose digest carries the target.
export const redirectsTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) });
export const notFound = { digest: expect.stringContaining("404") };
