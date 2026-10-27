"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/locales";
import { auth, requireUser } from "@/lib/auth";

// Logged-out actions (locale cookie, sign-in) need no auth helper: Better Auth decides who gets a session.

export async function setLocaleCookie(form: FormData) {
  const locale = z.enum(LOCALES).parse(form.get("locale"));
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
}

// Off to Google; its callback lands on "/" (each role's home) or on /login?error=<code>.
export async function signInWithGoogle() {
  const { url } = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" }, headers: await headers() });
  redirect(url!);
}

// The endpoint refuses in production and refuses inactive users (ACCOUNT_INACTIVE).
export async function devLogin(form: FormData) {
  const email = z.email().parse(form.get("email"));
  try {
    await auth.api.devLogin({ body: { email }, headers: await headers() });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    redirect(`/login?error=${error.body?.code ?? "failed"}`);
  }
  redirect("/");
}

export async function signOut() {
  await requireUser();
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
