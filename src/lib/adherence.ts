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

type Client = { id: string; trackingMode: string; timezone: string; today?: string };
// One day: its adherence by the client's current mode and, in CALORIES, the logged kcal and protein (null when nothing
// was logged) next to that day's targets.
export type NutritionDay = { date: string; adherence: Adherence | null; kcal: number | null; protein: number | null; kcalTarget: number | null; proteinTarget: number | null };

// Each client's days (their dates in `windows`). Eight queries for any number of clients and days.
// ponytail: GUIDANCE plans its day's meals or, without plan meals, the four default ones; marks on other slots aren't added.
export async function nutritionDays(clients: Client[], windows: Map<string, string[]>): Promise<Map<string, NutritionDay[]>> {
  const ids = clients.map((c) => c.id);
  const inMode = (mode: string) => clients.filter((c) => c.trackingMode === mode).map((c) => c.id);
  const dates = [...new Set([...windows.values()].flat())];
  const [targets, overrides, sessions, competitions, planMeals, entries, portions, marks] = await Promise.all([
    db.nutritionTarget.findMany({ where: { clientId: { in: ids } } }),
    db.nutritionDay.findMany({ where: { clientId: { in: ids }, date: { in: dates }, dayTypeOverride: { not: null } }, select: { clientId: true, date: true, dayTypeOverride: true } }),
    db.trainingSession.findMany({ where: { clientId: { in: ids }, date: { in: dates } }, select: { clientId: true, date: true } }),
    db.competition.findMany({ where: { clientId: { in: ids }, date: { in: dates } }, select: { clientId: true, date: true } }),
    db.planMeal.findMany({ where: { clientId: { in: inMode("GUIDANCE") } }, select: { clientId: true, dayType: true } }),
    db.foodEntry.findMany({ where: { clientId: { in: inMode("CALORIES") }, date: { in: dates } }, select: { clientId: true, date: true, kcal: true, protein: true } }),
    db.portionLog.findMany({ where: { clientId: { in: inMode("PORTIONS") }, date: { in: dates } } }),
    db.guidanceLog.findMany({ where: { clientId: { in: inMode("GUIDANCE") }, date: { in: dates } }, select: { clientId: true, date: true, followed: true } }),
  ]);

  return new Map(
    clients.map((c) => {
      const on = <T extends { clientId: string; date: string }>(rows: T[], date: string) => rows.filter((r) => r.clientId === c.id && r.date === date);
      const days = windows.get(c.id)!.map((date): NutritionDay => {
        const type = dayType({ override: on(overrides, date)[0]?.dayTypeOverride as DayType | undefined, competition: on(competitions, date).length > 0, session: on(sessions, date).length > 0 });
        const target = targetFor(
          targets.filter((t) => t.clientId === c.id),
          date,
          type,
        );
        const none = { date, kcal: null, protein: null, kcalTarget: null, proteinTarget: null };
        if (c.trackingMode === "CALORIES") {
          const logged = on(entries, date);
          const sum = (key: "kcal" | "protein") => (logged.length ? Math.round(logged.reduce((total, e) => total + e[key], 0)) : null);
          return { date, adherence: caloriesAdherence(logged, target), kcal: sum("kcal"), protein: sum("protein"), kcalTarget: target?.kcal ?? null, proteinTarget: target?.protein ?? null };
        }
        if (c.trackingMode === "PORTIONS") return { ...none, adherence: portionsAdherence(on(portions, date), target) };
        const planned = planMeals.filter((m) => m.clientId === c.id && m.dayType === type).length || 4;
        return { ...none, adherence: guidanceAdherence(on(marks, date).flatMap((m) => (m.followed ? [m.followed as Followed] : [])), planned) };
      });
      return [c.id, days];
    }),
  );
}

export type NutritionSummary = { lastLogged: string | null; daysAgo: number | null; adherence: number | null };

// For the coach's client list: each client's last logged day (any log of their current mode) and 7-day adherence %, the
// 7 days ending yesterday in the client's timezone (today is still in progress), or before `today` when given (a check-in's
// week ends the day before its due date). Eleven queries for any number of clients.
export async function nutritionSummaries(clients: Client[]): Promise<Map<string, NutritionSummary>> {
  const inMode = (mode: string) => clients.filter((c) => c.trackingMode === mode).map((c) => c.id);
  const today = new Map(clients.map((c) => [c.id, c.today ?? todayIn(c.timezone)]));
  const windows = new Map(clients.map((c) => [c.id, Array.from({ length: 7 }, (_, i) => addDays(today.get(c.id)!, -(i + 1)))]));
  const [days, lastEntry, lastPortion, lastMark] = await Promise.all([
    nutritionDays(clients, windows),
    db.foodEntry.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("CALORIES") } }, _max: { date: true } }),
    db.portionLog.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("PORTIONS") } }, _max: { date: true } }),
    db.guidanceLog.groupBy({ by: ["clientId"], where: { clientId: { in: inMode("GUIDANCE") } }, _max: { date: true } }),
  ]);
  const last = new Map([...lastEntry, ...lastPortion, ...lastMark].map((row) => [row.clientId, row._max.date]));

  return new Map(
    clients.map((c) => {
      const lastLogged = last.get(c.id) ?? null;
      return [c.id, { lastLogged, daysAgo: lastLogged == null ? null : diffDays(lastLogged, today.get(c.id)!), adherence: adherencePercent(days.get(c.id)!.map((d) => d.adherence)) }];
    }),
  );
}
