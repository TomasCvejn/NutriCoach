import { addDays, diffDays } from "./dates";
import { db } from "./db";
import type { Phase } from "./enums";
import { notify } from "./notifications";

// The phase on `today` of a competition on `date` (competition.md), by days to go: 28–15 four weeks, 14–8 two weeks, 7–2 race
// week, 1 the day before, 0 race day; earlier is "BASE", after it null.
export function competitionPhase(today: string, date: string): Phase | null {
  const days = diffDays(today, date);
  if (days < 0) return null;
  if (days === 0) return "RACE_DAY";
  if (days === 1) return "DAY_BEFORE";
  if (days <= 7) return "RACE_WEEK";
  if (days <= 14) return "2_WEEKS";
  if (days <= 28) return "4_WEEKS";
  return "BASE";
}

// The nearest competition from today on (today's counts), or none.
export const nextCompetition = <T extends { date: string }>(competitions: T[], today: string) =>
  competitions.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

// The lazy "competition phase started" notification (created on the /app load; the key makes it once per competition and
// phase): for each competition from four weeks out to race day.
export async function notifyPhaseStarted(userId: string, clientId: string, today: string) {
  const soon = await db.competition.findMany({ where: { clientId, date: { gte: today, lte: addDays(today, 28) } }, select: { id: true, name: true, date: true } });
  for (const competition of soon) {
    const phase = competitionPhase(today, competition.date);
    if (phase && phase !== "BASE") await notify(userId, "COMPETITION_PHASE_STARTED", { competition: competition.name }, `${competition.id}:${phase}`);
  }
}

// The day each phase starts, as days before the competition.
export const PHASE_STARTS: Record<Exclude<Phase, "BASE">, number> = { "4_WEEKS": 28, "2_WEEKS": 14, RACE_WEEK: 7, DAY_BEFORE: 1, RACE_DAY: 0 };
