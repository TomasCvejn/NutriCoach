import { INTENSITIES, type Intensity } from "./enums";

type Session = { type: string; durationMin: number; intensity: string };
type Rule = { id: string; name: string; sessionTypes: unknown; minDurationMin: number | null; maxDurationMin: number | null; minIntensity: string | null; priority: number };

const rank = (intensity: string) => INTENSITIES.indexOf(intensity as Intensity);

// Every condition of the rule holds: the session type is listed (no types = any), the duration is within the inclusive
// bounds, the intensity is at least the minimum.
export const matches = (template: Rule, session: Session) =>
  ((template.sessionTypes as string[]).length === 0 || (template.sessionTypes as string[]).includes(session.type)) &&
  (template.minDurationMin == null || session.durationMin >= template.minDurationMin) &&
  (template.maxDurationMin == null || session.durationMin <= template.maxDurationMin) &&
  (template.minIntensity == null || rank(session.intensity) >= rank(template.minIntensity));

// A session's fueling (training.md): the coach's override, else the highest-priority matching template (ties by name),
// else none.
export function fuelingFor<T extends Rule>(session: Session, templates: T[], overrideId: string | null) {
  if (overrideId) return templates.find((t) => t.id === overrideId) ?? null;
  return templates.filter((t) => matches(t, session)).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))[0] ?? null;
}

// What "during" adds up to over the session: per-hour amounts × the duration, rounded.
export function duringTotals(template: { duringCarbsPerHour: number | null; duringFluidPerHour: number | null; duringSodiumPerHour: number | null }, durationMin: number) {
  const total = (perHour: number | null) => (perHour == null ? null : Math.round((perHour * durationMin) / 60));
  return { carbs: total(template.duringCarbsPerHour), fluidMl: total(template.duringFluidPerHour), sodiumMg: total(template.duringSodiumPerHour) };
}

// The day's fluid target (training.md): the coach-set base, plus on TRAINING / COMPETITION days the during-session fluid
// of that day's fueling plans. No base → no target.
export const dailyFluidTarget = (base: number | null, dayType: string, sessionFluidMl: (number | null)[]) =>
  base == null ? null : base + (dayType === "REST" ? 0 : sessionFluidMl.reduce<number>((sum, ml) => sum + (ml ?? 0), 0));
