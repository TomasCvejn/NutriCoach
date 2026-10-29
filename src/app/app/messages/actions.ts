"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireClientAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletableSince } from "@/lib/messages";
import { notify } from "@/lib/notifications";

export type SendState = { invalid: true } | null;
const refresh = (clientId: string) => {
  revalidatePath("/app", "layout");
  revalidatePath("/coach", "layout");
  revalidatePath(`/coach/clients/${clientId}`, "layout");
};

// The client or their coach writes in the client's thread; the other one is notified.
export async function sendMessage(_: SendState, form: FormData): Promise<SendState> {
  const { user, client } = await requireClientAccess(String(form.get("clientId")));
  const text = z.string().trim().min(1).max(4000).safeParse(form.get("text"));
  if (!text.success) return { invalid: true };
  await db.message.create({ data: { clientId: client.id, senderId: user.id, text: text.data } });
  await notify(user.role === "COACH" ? client.userId : client.coachId, "NEW_MESSAGE", { from: user.name, clientId: client.id });
  refresh(client.id);
  return null;
}

// No editing; the sender may delete their own message within 5 minutes (enforced here, not just hidden in the UI).
export async function deleteMessage(form: FormData) {
  const user = await requireUser();
  const message = await db.message.findUnique({ where: { id: String(form.get("id")) }, select: { id: true, clientId: true } });
  await requireClientAccess(message?.clientId ?? "");
  const { count } = await db.message.deleteMany({ where: { id: message!.id, senderId: user.id, createdAt: { gte: deletableSince() } } });
  if (count === 0) notFound();
  refresh(message!.clientId);
}
