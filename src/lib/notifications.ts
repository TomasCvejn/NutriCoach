import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import type { NotificationType } from "./enums";

// What each type's text and target need, filled in by the action that causes the event.
// Names are snapshots, so a notification still reads right after its client is gone.
export type NotificationPayloads = {
  NEW_MESSAGE: { from: string; clientId: string };
  CHECK_IN_DUE: { dueDate: string }; // YYYY-MM-DD
  FEEDBACK_PUBLISHED: { checkInId: string };
  PLAN_UPDATED: Record<string, never>;
  CALL_SCHEDULED: { startsAt: string }; // ISO instant, shown in the viewer's timezone
  COMPETITION_PHASE_STARTED: { competition: string };
  ONBOARDING_COMPLETED: { client: string; clientId: string };
  CHECK_IN_SUBMITTED: { client: string; checkInId: string };
  CLIENT_DELETED_ACCOUNT: { client: string };
};

type Notification = { [T in NotificationType]: { type: T; payload: NotificationPayloads[T] } }[NotificationType];

// The only writer of notifications, called server-side by the action that causes the event (never a server action itself:
// it would let anyone notify anyone). With a key, the same (user, type, key) is written once: lazy notifications call it on
// every app load, and concurrent loads can't both insert because the unique index decides.
export async function notify<T extends NotificationType>(userId: string, type: T, payload: NotificationPayloads[T], key?: string) {
  // A type the user turned off in their settings isn't written at all.
  const user = await db.user.findUnique({ where: { id: userId }, select: { mutedNotifications: true } });
  if ((user?.mutedNotifications as string[] | undefined)?.includes(type)) return;
  try {
    await db.notification.create({ data: { userId, type, payload, key } });
  } catch (error) {
    if (key && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

// Where a notification leads; the recipient's role decides the area (messages go both ways).
// Targets of features still to come are the routes their items build.
export function notificationHref(role: string, row: { type: string; payload: unknown }): string {
  const n = row as Notification;
  switch (n.type) {
    case "NEW_MESSAGE":
      return role === "COACH" ? `/coach/messages?client=${n.payload.clientId}` : "/app/messages";
    case "CHECK_IN_DUE":
      return "/app/check-in";
    case "FEEDBACK_PUBLISHED":
      return `/app/check-in/${n.payload.checkInId}`;
    case "PLAN_UPDATED":
      return "/app/plan";
    case "CALL_SCHEDULED":
      return "/app/calendar";
    case "COMPETITION_PHASE_STARTED":
      return "/app/competition";
    case "ONBOARDING_COMPLETED":
      return `/coach/clients/${n.payload.clientId}`;
    case "CHECK_IN_SUBMITTED":
      return `/coach/check-ins/${n.payload.checkInId}`;
    case "CLIENT_DELETED_ACCOUNT":
      return "/coach/clients";
  }
}
