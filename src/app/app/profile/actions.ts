"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireClientAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROFILE_SECTION_KEYS, PROFILE_SECTIONS, profileInput, type Refused, refused } from "@/lib/profile";

export type ProfileFormState = { saved: true } | Refused | null;

const target = z.object({ clientId: z.string(), section: z.enum(PROFILE_SECTION_KEYS) });

// Shared by /app/profile (the client's own) and /coach/clients/[id]/profile (the coach's client). Saves one section.
export async function saveProfile(_: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  await requireUser();
  const { clientId, section } = target.parse(Object.fromEntries(form));
  const { client } = await requireClientAccess(clientId);

  const input = profileInput(form);
  const parsed = PROFILE_SECTIONS[section].safeParse(input);
  if (!parsed.success) return refused(parsed.error, input);
  const { name, ...data }: { name?: string } & Prisma.ClientUpdateInput = parsed.data;
  await db.client.update({ where: { id: client.id }, data: { ...data, user: name ? { update: { name } } : undefined } });
  revalidatePath("/", "layout"); // the name in the shell and the client list, the Training tab once a sport is set
  return { saved: true };
}
