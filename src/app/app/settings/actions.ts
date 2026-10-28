"use server";

import { revalidatePath } from "next/cache";
import { setLocaleCookie } from "@/app/login/actions";
import { inviteChoices, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Shared by /app/settings and /coach/settings. Writes only the signed-in user's own row.
// The same language + IANA zone choices the invite page asks for.
const settings = inviteChoices.pick({ locale: true, timezone: true });

export async function saveSettings(form: FormData) {
  const user = await requireUser();
  const data = settings.parse(Object.fromEntries(form));
  await db.user.update({ where: { id: user.id }, data });
  await setLocaleCookie(form); // the login page keeps the language after sign-out
  revalidatePath("/", "layout"); // the whole UI, shell included, re-renders in the new language
}
