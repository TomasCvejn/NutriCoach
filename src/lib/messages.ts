import { db } from "./db";

// How long the sender may still delete a message.
export const DELETE_WINDOW_MS = 5 * 60 * 1000;
export const deletableSince = () => new Date(Date.now() - DELETE_WINDOW_MS);

// Unread messages (messaging.md): for a client those in their thread from the coach; for a coach those from their clients.
export const unreadMessages = (user: { id: string; role: string }) =>
  db.message.count({ where: { senderId: { not: user.id }, readAt: null, client: user.role === "COACH" ? { coachId: user.id } : { userId: user.id } } });

// What the nav shows: unread notifications (the bell) and messages.
export async function badgesOf(user: { id: string; role: string }) {
  const [notifications, messages] = await Promise.all([db.notification.count({ where: { userId: user.id, readAt: null } }), unreadMessages(user)]);
  return { notifications, messages };
}
export type Badges = Awaited<ReturnType<typeof badgesOf>>;
