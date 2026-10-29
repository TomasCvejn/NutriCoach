import { adherencePercent, type NutritionDay } from "./adherence";
import { addDays, diffDays, weekday } from "./dates";

// The Mondays of the last `count` weeks, the current week last.
export function weekStarts(today: string, count: number) {
  const monday = addDays(today, 1 - weekday(today));
  return Array.from({ length: count }, (_, i) => addDays(monday, -7 * (count - 1 - i)));
}

const average = (values: (number | null)[]) => {
  const known = values.filter((v) => v != null);
  return known.length ? Math.round(known.reduce((sum, v) => sum + v, 0) / known.length) : null;
};

// Per week: adherence % of its days, and the average kcal and protein of the days with a log next to the average target
// of those same days. A week counts only the days it was given (the current one up to yesterday); no data → null.
export function weeklyNutrition(days: NutritionDay[], starts: string[]) {
  return starts.map((start) => {
    const week = days.filter((d) => d.date >= start && d.date < addDays(start, 7));
    const logged = week.filter((d) => d.kcal != null);
    return {
      start,
      adherence: adherencePercent(week.map((d) => d.adherence)),
      kcal: average(logged.map((d) => d.kcal)),
      kcalTarget: average(logged.map((d) => d.kcalTarget)),
      protein: average(logged.map((d) => d.protein)),
      proteinTarget: average(logged.map((d) => d.proteinTarget)),
    };
  });
}

// The days from `start` up to yesterday (today is still in progress).
export const daysUntilToday = (start: string, today: string) => Array.from({ length: Math.max(0, diffDays(start, today)) }, (_, i) => addDays(start, i));
