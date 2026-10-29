import { clientRows, needsAttention } from "./client-list";
import { addDays, diffDays, todayIn } from "./dates";
import { db } from "./db";
import { unreadMessages } from "./messages";

// Everything the coach home shows (coach.md): the tiles, the competitions of the next 30 days with client and days left,
// and the clients that need attention. A fixed number of queries however many clients the coach has.
export async function coachHome(coach: { id: string; timezone: string }, now = new Date()) {
  const today = todayIn(coach.timezone, now);
  const active = { coachId: coach.id, user: { active: true } };
  const [rows, checkInsWaiting, competitions, unread, callsSoon] = await Promise.all([
    clientRows(coach),
    db.checkIn.count({ where: { reviewedAt: null, client: active } }),
    // ponytail: by the coach's calendar; a client a timezone away may be a day off at the edges.
    db.competition.findMany({
      where: { date: { gte: today, lte: addDays(today, 30) }, client: active },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true, clientId: true, client: { select: { user: { select: { name: true } } } } },
    }),
    unreadMessages({ id: coach.id, role: "COACH" }),
    db.call.count({ where: { startsAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) }, client: active } }),
  ]);
  return {
    activeClients: rows.filter((r) => r.status !== "INACTIVE").length,
    checkInsWaiting,
    unreadMessages: unread,
    callsSoon,
    competitions: competitions.map((c) => ({ id: c.id, name: c.name, clientId: c.clientId, client: c.client.user.name, days: diffDays(today, c.date) })),
    attention: needsAttention(rows),
  };
}
