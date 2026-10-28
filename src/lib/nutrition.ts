import { ageOn } from "./dates";
import type { DayType, Followed, TrackingMode } from "./enums";

// Day type of a date (00-overview.md): an override wins, then a competition that day, then any training session, else REST.
export function dayType({ override, competition, session }: { override?: DayType | null; competition?: boolean; session?: boolean }): DayType {
  return override ?? (competition ? "COMPETITION" : session ? "TRAINING" : "REST");
}

// The target in force on a date for a day type (nutrition.md): the row with the latest effectiveFrom ≤ date. TRAINING and
// COMPETITION targets are optional and fall back to REST. One row per day type and effectiveFrom, so there are no ties.
export function targetFor<T extends { dayType: string; effectiveFrom: string }>(targets: T[], date: string, type: DayType): T | undefined {
  const latest = (of: DayType) =>
    targets.reduce<T | undefined>((best, t) => (t.dayType === of && t.effectiveFrom <= date && (!best || t.effectiveFrom > best.effectiveFrom) ? t : best), undefined);
  return latest(type) ?? latest("REST");
}

type Macros = { protein: number; carbs: number; fat: number };
export const kcalFromMacros = ({ protein, carbs, fat }: Macros) => protein * 4 + carbs * 4 + fat * 9;
// The editor warns when the kcal entered is more than 5 % off what the macros add up to.
export const kcalMismatch = (kcal: number, macros: Macros) => Math.abs(kcalFromMacros(macros) - kcal) > 0.05 * kcal;

// Grams per kg of body weight, one decimal; null without a weight.
export const perKg = (grams: number, weightKg: number | null) => (weightKg ? Math.round((grams / weightKg) * 10) / 10 : null);

// Weight for g/kg, suggestions and "latest weight": the latest body-composition entry, else the profile.
export const latestWeight = (profileWeightKg: number | null, latestBodyComp?: { weightKg: number | null } | null) => latestBodyComp?.weightKg ?? profileWeightKg;

export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725] as const;
const GOAL_ADJUSTMENT: Partial<Record<string, number>> = { LOSE_FAT: -0.2, GAIN_MUSCLE: 0.1 };

// "Suggest" for the CALORIES REST target: Mifflin-St Jeor BMR × activity factor, ± the goal's adjustment; protein 2 g/kg,
// fat 25 % of kcal, carbs the rest. Whole kcal and grams. Null when sex, birth date, height or weight is missing.
export function suggestTargets(
  profile: { sex: string | null; birthDate: string | null; heightCm: number | null; primaryGoal: string | null },
  weightKg: number | null,
  today: string,
  factor: (typeof ACTIVITY_FACTORS)[number],
) {
  const { sex, birthDate, heightCm, primaryGoal } = profile;
  if (!sex || !birthDate || !heightCm || !weightKg) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageOn(birthDate, today) + (sex === "MALE" ? 5 : -161);
  const kcal = Math.round(bmr * factor * (1 + (GOAL_ADJUSTMENT[primaryGoal ?? ""] ?? 0)));
  const protein = Math.round(2 * weightKg);
  const fat = Math.round((0.25 * kcal) / 9);
  return { kcal, protein, fat, carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) };
}

// Daily fluid base: 35 ml/kg, to the nearest 50 ml; null without a weight.
export const suggestFluid = (weightKg: number | null) => (weightKg ? Math.round((weightKg * 35) / 50) * 50 : null);

// The target numbers each tracking mode edits; every mode also sets fluid. A NutritionTarget row holds all of them.
export const TARGET_FIELDS = {
  CALORIES: ["kcal", "protein", "carbs", "fat", "fiber", "sodium"],
  PORTIONS: ["palms", "hands", "fists", "thumbs"],
  GUIDANCE: [],
} as const satisfies Record<TrackingMode, readonly string[]>;
export const TARGET_VALUE_FIELDS = [...TARGET_FIELDS.CALORIES, ...TARGET_FIELDS.PORTIONS, "fluidMl"] as const;
export type TargetField = (typeof TARGET_VALUE_FIELDS)[number];
export type TargetValues = Record<TargetField, number | null>;
export const modeFields = (mode: TrackingMode): TargetField[] => [...TARGET_FIELDS[mode], "fluidMl"];

// A day's meal slots: the plan's meals for its day type (else the default four), then any other slot that day's entries
// were logged into (entries keep their slot name, so a later plan change never moves them).
export function mealSlots(planMeals: string[], entrySlots: string[], fallback: string[]) {
  return [...new Set([...(planMeals.length ? planMeals : fallback), ...entrySlots])];
}

// Adherence of one day (nutrition.md). null = no target that day, so the day is left out of any percentage.
export type Adherence = "ADHERENT" | "MISSED" | "NOT_LOGGED";
const total = <K extends string>(rows: Partial<Record<K, number | null>>[], key: K) => rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);

// CALORIES: at least one entry, kcal within ±10 % of the target and protein at least 90 % of it (when set). Totals are
// compared as shown, in whole kcal and grams.
export function caloriesAdherence(entries: { kcal: number; protein: number }[], target: { kcal: number | null; protein: number | null } | undefined): Adherence | null {
  if (!target?.kcal) return null;
  if (entries.length === 0) return "NOT_LOGGED";
  const kcal = Math.round(total(entries, "kcal"));
  const protein = Math.round(total(entries, "protein"));
  return Math.abs(kcal - target.kcal) <= 0.1 * target.kcal && (target.protein == null || protein >= 0.9 * target.protein) ? "ADHERENT" : "MISSED";
}

// PORTIONS: every category the target sets is within ±1 portion of it.
export function portionsAdherence(logs: Partial<Record<(typeof TARGET_FIELDS.PORTIONS)[number], number | null>>[], target: Partial<TargetValues> | undefined): Adherence | null {
  const set = TARGET_FIELDS.PORTIONS.filter((p) => target?.[p] != null);
  if (set.length === 0) return null;
  if (logs.length === 0) return "NOT_LOGGED";
  return set.every((p) => Math.abs(total(logs, p) - target![p]!) <= 1) ? "ADHERENT" : "MISSED";
}

// GUIDANCE: (yes + ½ × partly) / planned meals ≥ 0.75; the planned meals are the day's meal slots.
export function guidanceAdherence(marks: Followed[], plannedMeals: number): Adherence | null {
  if (plannedMeals === 0) return null;
  if (marks.length === 0) return "NOT_LOGGED";
  const score = marks.filter((m) => m === "YES").length + 0.5 * marks.filter((m) => m === "PARTLY").length;
  return score / plannedMeals >= 0.75 ? "ADHERENT" : "MISSED";
}
