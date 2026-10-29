import { addDays, diffDays, localOf, todayIn, weekday } from "./dates";
import { db } from "./db";

type Session = { id: string; clientId: string; date: string; startTime: string | null; type: string; sport: string | null; durationMin: number };
type Competition = { id: string; clientId: string; date: string; name: string };
type Call = { id: string; clientId: string; startsAt: Date; durationMin: number; link: string | null; agenda: string | null };
type CheckInDay = { clientId: string; weekday: number; since: string | null }; // since: the first day check-ins count (onboarding done)

export type CalendarItem = { date: string; time: string | null; clientId: string } & (
  | { type: "SESSION"; session: Session }
  | { type: "COMPETITION"; competition: Competition }
  | { type: "CALL"; call: Call }
  | { type: "CHECK_IN" }
);

// The calendar's items from `from` to `to` (calendar days in the viewer's timezone, both included): sessions and
// competitions on their days, calls at their instant in the viewer's timezone, and each client's weekly check-in day
// from the day their check-ins start. Ordered by day, then time (all-day items first).
export function calendarItems({ from, to, timezone, sessions, competitions, calls, checkIns }: { from: string; to: string; timezone: string; sessions: Session[]; competitions: Competition[]; calls: Call[]; checkIns: CheckInDay[] }) {
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i));
  const inRange = (date: string) => date >= from && date <= to;
  const items: CalendarItem[] = [
    ...sessions.filter((s) => inRange(s.date)).map((session) => ({ type: "SESSION" as const, date: session.date, time: session.startTime, clientId: session.clientId, session })),
    ...competitions.filter((c) => inRange(c.date)).map((competition) => ({ type: "COMPETITION" as const, date: competition.date, time: null, clientId: competition.clientId, competition })),
    ...calls.flatMap((call) => {
      const [date, time] = localOf(call.startsAt, timezone).split("T");
      return inRange(date) ? [{ type: "CALL" as const, date, time, clientId: call.clientId, call }] : [];
    }),
    ...checkIns.flatMap(({ clientId, weekday: day, since }) =>
      since ? days.filter((date) => weekday(date) === day && date >= since).map((date) => ({ type: "CHECK_IN" as const, date, time: null, clientId })) : [],
    ),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

type Client = { id: string; checkInWeekday: number; onboardingCompletedAt: Date | null; user: { timezone: string } };

// The calendar items of these clients from `from` to `to`, seen from `timezone`. Three queries for any number of clients.
export async function loadCalendar(clients: Client[], from: string, to: string, timezone: string) {
  const clientId = { in: clients.map((c) => c.id) };
  const [sessions, competitions, calls] = await Promise.all([
    db.trainingSession.findMany({ where: { clientId, date: { gte: from, lte: to } } }),
    db.competition.findMany({ where: { clientId, date: { gte: from, lte: to } } }),
    // A day either side covers any timezone; the builder keeps the ones on the viewer's days.
    db.call.findMany({ where: { clientId, startsAt: { gte: new Date(`${addDays(from, -1)}T00:00:00Z`), lt: new Date(`${addDays(to, 2)}T00:00:00Z`) } } }),
  ]);
  const checkIns = clients.map((c) => ({ clientId: c.id, weekday: c.checkInWeekday, since: c.onboardingCompletedAt && todayIn(c.user.timezone, c.onboardingCompletedAt) }));
  return calendarItems({ from, to, timezone, sessions, competitions, calls, checkIns });
}
