"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireClient, requireCoachOf, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROFILE_SECTION_KEYS, PROFILE_SECTIONS, profileInput } from "@/lib/profile";

export type ProfileFormState = { saved: true } | { invalid: string[] } | null;

const target = z.object({ clientId: z.string(), section: z.enum(PROFILE_SECTION_KEYS) });

// Shared by /app/profile (the client's own) and /coach/clients/[id]/profile (the coach's client). Saves one section.
export async function saveProfile(_: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const { clientId, section } = target.parse(Object.fromEntries(form));
  // A client saves only their own profile, a coach only their own client's; anything else looks like it doesn't exist.
  const { client } = user.role === "COACH" ? await requireCoachOf(clientId) : await requireClient();
  if (client.id !== clientId) notFound();

  const parsed = PROFILE_SECTIONS[section].safeParse(profileInput(form));
  if (!parsed.success) return { invalid: parsed.error.issues.map((issue) => String(issue.path[0])) };
  const { name, ...data }: { name?: string } & Prisma.ClientUpdateInput = parsed.data;
  await db.client.update({ where: { id: client.id }, data: { ...data, user: name ? { update: { name } } : undefined } });
  revalidatePath("/", "layout"); // the name in the shell and the client list, the Training tab once a sport is set
  return { saved: true };
}
