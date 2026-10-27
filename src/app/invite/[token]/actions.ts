"use server";

import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { acceptInvite, auth, devLoginEnabled, inviteChoices } from "@/lib/auth";

// Logged-out actions: the invite token is the credential, and acceptInvite checks it in its transaction.
// The client's language is the one the invite page is shown in (switched in its header).
async function choices(form: FormData) {
  return inviteChoices.parse({ token: form.get("token"), timezone: form.get("timezone"), locale: await getLocale() });
}

// Off to Google with the choices in the OAuth state; the Google profile hook in auth.ts accepts the invite.
export async function acceptWithGoogle(form: FormData) {
  const invite = await choices(form);
  const { url } = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/app", errorCallbackURL: `/invite/${invite.token}`, additionalData: { invite } },
    headers: await headers(),
  });
  redirect(url!);
}

// Without Google (dev and e2e): accept as the typed email, then dev login. Refused in production.
export async function devAcceptInvite(form: FormData) {
  if (!devLoginEnabled()) notFound();
  const invite = await choices(form);
  const email = String(form.get("email"));
  const error = await acceptInvite({ ...invite, email });
  if (error) redirect(`/invite/${invite.token}?error=${error}`);
  await auth.api.devLogin({ body: { email }, headers: await headers() });
  redirect("/app");
}
