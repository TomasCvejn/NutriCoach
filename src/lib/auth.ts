import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/i18n/locales";
import { db } from "./db";
import type { Role } from "./enums";

// Without Google credentials the app still runs: the login page hides the Google button and dev login takes over.
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const devLoginEnabled = () => process.env.NODE_ENV !== "production";

// Sign in as any existing user with one click, so the app runs without Google and e2e can log in. Refused in production.
const devLogin = {
  id: "dev-login",
  endpoints: {
    devLogin: createAuthEndpoint("/dev-login", { method: "POST", body: z.object({ email: z.email() }) }, async (ctx) => {
      if (!devLoginEnabled()) throw new APIError("NOT_FOUND");
      const found = await ctx.context.internalAdapter.findUserByEmail(ctx.body.email.toLowerCase());
      if (!found) throw new APIError("NOT_FOUND");
      const session = await ctx.context.internalAdapter.createSession(found.user.id); // inactive → the hook below throws
      await setSessionCookie(ctx, { session, user: found.user });
      return ctx.json({ ok: true });
    }),
  },
} satisfies BetterAuthPlugin;

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  // Google only, and only for existing users: coaches come from the CLI, clients from invites.
  socialProviders: googleEnabled
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, disableSignUp: true } }
    : {},
  // Users have no credentials of their own (no passwords), so the first sign-in with a Google-verified email claims the row.
  account: { accountLinking: { requireLocalEmailVerified: false } },
  user: {
    // input: false — users must never set these through Better Auth's own endpoints (e.g. /update-user).
    additionalFields: {
      role: { type: "string", required: true, input: false },
      active: { type: "boolean", required: true, defaultValue: true, input: false },
      timezone: { type: "string", required: true, defaultValue: DEFAULT_TIMEZONE, input: false },
      locale: { type: "string", required: true, defaultValue: DEFAULT_LOCALE, input: false },
    },
  },
  // Inactive users can't sign in: refuse the session before it exists (requireUser also rejects live ones).
  // The Google callback turns the code into /login?error=ACCOUNT_INACTIVE.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { active: true } });
          if (!user?.active) throw APIError.from("FORBIDDEN", { code: "ACCOUNT_INACTIVE", message: "Account is inactive" });
        },
      },
    },
  },
  onAPIError: { errorURL: "/login" }, // OAuth failures land on /login?error=<code>
  plugins: [devLogin, nextCookies()], // nextCookies must stay the last plugin
});

type NewUser = Omit<Prisma.UserCreateInput, "id" | "accounts" | "role"> & { role: Role };

// The only way users are created (CLI, seed, invite acceptance). No account row: Google links on first sign-in.
export async function createUser(data: NewUser) {
  return db.user.create({ data: { ...data, email: data.email.toLowerCase() } }); // Better Auth looks emails up lowercased
}

// One session lookup per request, shared by layouts, pages and the i18n config.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

// Authorization helpers: every server action, route handler and data-loading server component goes through these.
export async function requireUser() {
  const session = await getSession();
  if (!session?.user.active) redirect("/login");
  return session.user;
}

export async function requireCoach() {
  const user = await requireUser();
  if (user.role !== "COACH") redirect("/app");
  return user;
}

export async function requireClient() {
  const user = await requireUser();
  if (user.role !== "CLIENT") redirect("/coach");
  const client = await db.client.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, client };
}

// Another coach's client looks like it doesn't exist.
export async function requireCoachOf(clientId: string) {
  const coach = await requireCoach();
  const client = await db.client.findFirst({ where: { id: clientId, coachId: coach.id } });
  if (!client) notFound();
  return { coach, client };
}
