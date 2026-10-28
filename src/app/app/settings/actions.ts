"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setLocaleCookie } from "@/app/login/actions";
import { inviteChoices, requireCoach, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { optional } from "@/lib/forms";

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

const welcome = z.object({ welcomeText: optional(z.string().trim().max(2000)) });

// Coach only: the welcome on their clients' first onboarding screen. Empty → the i18n default in the client's language.
export async function saveWelcomeText(form: FormData) {
  const coach = await requireCoach();
  const { welcomeText } = welcome.parse(Object.fromEntries(form));
  await db.user.update({ where: { id: coach.id }, data: { welcomeText } });
  revalidatePath("/coach/settings");
}
