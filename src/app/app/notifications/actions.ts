"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notificationHref } from "@/lib/notifications";

// Shared by /app/notifications and /coach/notifications. Every query is scoped to the signed-in user,
// so another user's notification looks like it doesn't exist.
const id = z.string().min(1).max(64);

// The bell's count lives in the area layout.
const refreshBell = () => revalidatePath("/", "layout");

// Opening an item marks it read and goes to its target.
export async function openNotification(form: FormData) {
  const user = await requireUser();
  const notification = await db.notification.findFirst({ where: { id: id.parse(form.get("id")), userId: user.id } });
  if (!notification) notFound();
  if (!notification.readAt) await db.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  refreshBell();
  redirect(notificationHref(user.role, notification));
}

export async function markRead(form: FormData) {
  const user = await requireUser();
  const { count } = await db.notification.updateMany({ where: { id: id.parse(form.get("id")), userId: user.id }, data: { readAt: new Date() } });
  if (count === 0) notFound();
  refreshBell();
}

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refreshBell();
}
