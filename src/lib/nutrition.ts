import { ageOn } from "./dates";
import type { DayType } from "./enums";

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
