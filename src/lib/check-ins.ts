import { addDays, diffDays, todayIn, weekday } from "./dates";
import { db } from "./db";
import type { CheckInStatus } from "./enums";
import { notify } from "./notifications";

// The current check-in period (IMPLEMENTATION_PLAN.md Notes): its due date is the latest check-in weekday on or before
// today in the client's timezone, never before the day onboarding was finished (null = no period yet).
export function currentDueDate(today: string, checkInWeekday: number, onboardedOn: string | null) {
  if (!onboardedOn) return null;
  const dueDate = addDays(today, -((weekday(today) - checkInWeekday + 7) % 7));
  return dueDate < onboardedOn ? null : dueDate;
}

// ok: nothing to do (reviewed, or no period yet) · due: the form is open · overdue: 2+ days after the due date ·
// toReview: submitted, waiting for the coach.
export function checkInStatus(today: string, dueDate: string | null, checkIn: { reviewedAt: Date | null } | null): CheckInStatus {
  if (!dueDate) return "ok";
  if (checkIn) return checkIn.reviewedAt ? "ok" : "toReview";
  return diffDays(dueDate, today) >= 2 ? "overdue" : "due";
}

type Client = { id: string; checkInWeekday: number; onboardingCompletedAt: Date | null };

// The client's current check-in period: its due date, the check-in for it (if submitted) and the status.
export async function currentCheckIn(client: Client, timezone: string) {
  const today = todayIn(timezone);
  const onboardedOn = client.onboardingCompletedAt && todayIn(timezone, client.onboardingCompletedAt);
  const dueDate = currentDueDate(today, client.checkInWeekday, onboardedOn);
  const checkIn = dueDate ? await db.checkIn.findUnique({ where: { clientId_dueDate: { clientId: client.id, dueDate } } }) : null;
  return { today, dueDate, checkIn, status: checkInStatus(today, dueDate, checkIn) };
}

// The lazy "check-in due" notification (Notes: created on the /app load, once per period thanks to the key).
export async function notifyCheckInDue(userId: string, period: Awaited<ReturnType<typeof currentCheckIn>>) {
  if (period.dueDate && (period.status === "due" || period.status === "overdue")) await notify(userId, "CHECK_IN_DUE", { dueDate: period.dueDate }, period.dueDate);
}

// The check-in status of many clients at once (the coach's client list): one query for every client's current period.
export async function checkInStatuses(clients: (Client & { timezone: string })[]) {
  const periods = clients.map((c) => {
    const today = todayIn(c.timezone);
    return { id: c.id, today, dueDate: currentDueDate(today, c.checkInWeekday, c.onboardingCompletedAt && todayIn(c.timezone, c.onboardingCompletedAt)) };
  });
  const checkIns = await db.checkIn.findMany({
    where: { OR: periods.flatMap((p) => (p.dueDate ? [{ clientId: p.id, dueDate: p.dueDate }] : [])) },
    select: { clientId: true, dueDate: true, reviewedAt: true },
  });
  return new Map(periods.map((p) => [p.id, checkInStatus(p.today, p.dueDate, checkIns.find((c) => c.clientId === p.id && c.dueDate === p.dueDate) ?? null)]));
}
