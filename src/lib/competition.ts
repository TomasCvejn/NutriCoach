import { diffDays } from "./dates";
import type { Phase } from "./enums";

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
