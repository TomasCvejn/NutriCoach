import { addDays, diffDays, todayIn } from "./dates";
import { db } from "./db";
import type { DayType, Followed } from "./enums";
import { type Adherence, caloriesAdherence, dayType, guidanceAdherence, portionsAdherence, targetFor } from "./nutrition";

// The share of adherent days among the days that had a target (nothing logged counts as not adherent); null when no day
// had a target.
export function adherencePercent(days: (Adherence | null)[]) {
  const counted = days.filter((d) => d !== null);
  return counted.length ? Math.round((counted.filter((d) => d === "ADHERENT").length / counted.length) * 100) : null;
}

type Client = { id: string; trackingMode: string; timezone: string };
export type NutritionSummary = { lastLogged: string | null; daysAgo: number | null; adherence: number | null };

// For the coach's client list: each client's last logged day (any log of their current mode) and 7-day adherence %, the
// 7 days ending yesterday in the client's timezone (today is still in progress). Nine queries for any number of clients.
// ponytail: GUIDANCE plans its day's meals or, without plan meals, the four default ones; marks on other slots aren't added.
export async function nutritionSummaries(clients: Client[]): Promise<Map<string, NutritionSummary>> {
  const ids = clients.map((c) => c.id);
  const inMode = (mode: string) => clients.filter((c) => c.trackingMode === mode).map((c) => c.id);
  const today = new Map(clients.map((c) => [c.id, todayIn(c.timezone)]));
  const windows = new Map(clients.map((c) => [c.id, Array.from({ length: 7 }, (_, i) => addDays(today.get(c.id)!, -(i + 1)))]));
  const dates = [...new Set([...windows.values()].flat())];
  const [targets, overrides, planMeals, entries, portions, marks, lastEntry, lastPortion, lastMark] = await Promise.all([
    db.nutritionTarget.findMany({ where: { clientId: { in: ids } } }),
    db.nutritionDay.findMany({ where: { clientId: { in: ids }, date: { in: dates }, dayTypeOverride: { not: null } }, select: { clientId: true, date: true, dayTypeOverride: true } }),
    db.planMeal.findMany({ where: { clientId: { in: inMode("GUIDANCE") } }, select: { clientId: true, dayType: true } }),
    db.foodEntry.findMany({ where: { clientId: { in: inMode("CALORIES") }, date: { in: dates } }, select: { clientId: true, date: true, kcal: true, protein: true } }),
    db.portionLog.findMany({ where: { clientId: { in: inMode("PORTIONS") }, date: { in: dates } } }),
    db.guidanceLog.findMany({ where: { clientId: { in: inMode("GUIDANCE") }, date: { in: dates } }, select: { clientId: true, date: true, followed: true } }),
    db.foodEntry.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("CALORIES") } }, _max: { date: true } }),
    db.portionLog.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("PORTIONS") } }, _max: { date: true } }),
    db.guidanceLog.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("GUIDANCE") } }, _max: { date: true } }),
  ]);
  const last = new Map([...lastEntry, ...lastPortion, ...lastMark].map((row) => [row.clientId, row._max.date]));

  return new Map(
    clients.map((c) => {
      const on = <T extends { clientId: string; date: string }>(rows: T[], date: string) => rows.filter((r) => r.clientId === c.id && r.date === date);
      const days = windows.get(c.id)!.map((date) => {
        const type = dayType({ override: on(overrides, date)[0]?.dayTypeOverride as DayType | undefined });
        const target = targetFor(
          targets.filter((t) => t.clientId === c.id),
          date,
          type,
        );
        if (c.trackingMode === "CALORIES") return caloriesAdherence(on(entries, date), target);
        if (c.trackingMode === "PORTIONS") return portionsAdherence(on(portions, date), target);
        const planned = planMeals.filter((m) => m.clientId === c.id && m.dayType === type).length || 4;
        return guidanceAdherence(on(marks, date).flatMap((m) => (m.followed ? [m.followed as Followed] : [])), planned);
      });
      const lastLogged = last.get(c.id) ?? null;
      return [c.id, { lastLogged, daysAgo: lastLogged == null ? null : diffDays(lastLogged, today.get(c.id)!), adherence: adherencePercent(days) }];
    }),
  );
}
