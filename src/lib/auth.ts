import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/i18n/locales";
import { db } from "./db";
import type { Role } from "./enums";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  // Coaches come from the CLI, clients from invites: no public sign-up.
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    // input: false — users must never set these through Better Auth's own endpoints (e.g. /update-user).
    additionalFields: {
      role: { type: "string", required: true, input: false },
      active: { type: "boolean", required: true, defaultValue: true, input: false },
      timezone: { type: "string", required: true, defaultValue: DEFAULT_TIMEZONE, input: false },
      locale: { type: "string", required: true, defaultValue: DEFAULT_LOCALE, input: false },
    },
  },
  plugins: [nextCookies()], // must stay the last plugin
});

type NewUser = Omit<Prisma.UserCreateInput, "id" | "accounts" | "role"> & { role: Role; password: string };

// The only way users are created (CLI, seed, invite acceptance), with the password hash Better Auth verifies.
export async function createUser({ password, ...data }: NewUser) {
  const id = randomUUID();
  return db.user.create({
    data: {
      ...data,
      id,
      email: data.email.toLowerCase(), // Better Auth lowercases on sign-in
      accounts: { create: { accountId: id, providerId: "credential", password: await hashPassword(password) } },
    },
  });
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
