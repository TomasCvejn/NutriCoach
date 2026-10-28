import { expect, test } from "vitest";
import { dayType, kcalFromMacros, kcalMismatch, latestWeight, perKg, suggestFluid, suggestTargets, targetFor } from "./nutrition";

test("dayType: override > competition > session > REST", () => {
  expect(dayType({})).toBe("REST");
  expect(dayType({ session: true })).toBe("TRAINING");
  expect(dayType({ competition: true, session: true })).toBe("COMPETITION");
  expect(dayType({ override: "REST", competition: true, session: true })).toBe("REST");
  expect(dayType({ override: "TRAINING" })).toBe("TRAINING");
  expect(dayType({ override: null, session: true })).toBe("TRAINING");
});

test("targetFor: latest effectiveFrom on or before the date; TRAINING / COMPETITION fall back to REST", () => {
  const targets = [
    { dayType: "REST", effectiveFrom: "2026-10-01", kcal: 2000 },
    { dayType: "REST", effectiveFrom: "2026-10-15", kcal: 1900 },
    { dayType: "TRAINING", effectiveFrom: "2026-10-10", kcal: 2400 },
  ];
  expect(targetFor(targets, "2026-09-30", "REST")).toBeUndefined();
  expect(targetFor(targets, "2026-10-14", "REST")?.kcal).toBe(2000);
  expect(targetFor(targets, "2026-10-15", "REST")?.kcal).toBe(1900);
  expect(targetFor(targets, "2026-10-09", "TRAINING")?.kcal).toBe(2000); // no TRAINING target yet → REST
  expect(targetFor(targets, "2026-10-20", "TRAINING")?.kcal).toBe(2400);
  expect(targetFor(targets, "2026-10-20", "COMPETITION")?.kcal).toBe(1900);
});

test("kcal from macros 4/4/9 and the 5 % warning on both sides", () => {
  const macros = { protein: 150, carbs: 250, fat: 70 }; // 600 + 1000 + 630 = 2230
  expect(kcalFromMacros(macros)).toBe(2230);
  expect(kcalMismatch(2230, macros)).toBe(false);
  expect(kcalMismatch(2124, macros)).toBe(false); // 106 off ≤ 5 % of 2124
  expect(kcalMismatch(2120, macros)).toBe(true); // 110 off > 106
  expect(kcalMismatch(2400, macros)).toBe(true);
  expect(kcalMismatch(0, { protein: 0, carbs: 0, fat: 0 })).toBe(false);
});

test("g/kg to one decimal, the weight from body composition before the profile", () => {
  expect(perKg(150, 80)).toBe(1.9);
  expect(perKg(117, 58.4)).toBe(2);
  expect(perKg(150, null)).toBeNull();
  expect(latestWeight(80)).toBe(80);
  expect(latestWeight(80, { weightKg: 78.5 })).toBe(78.5);
  expect(latestWeight(80, { weightKg: null })).toBe(80);
  expect(latestWeight(null, null)).toBeNull();
});

test("Mifflin-St Jeor suggestion: activity factor, goal adjustment, 2 g/kg protein, 25 % fat, carbs the rest", () => {
  const man = { sex: "MALE", birthDate: "1996-05-01", heightCm: 180, primaryGoal: "LOSE_FAT" };
  // Age 30: BMR 800 + 1125 − 150 + 5 = 1780; × 1.55 = 2759; − 20 % = 2207.2
  expect(suggestTargets(man, 80, "2026-10-28", 1.55)).toEqual({ kcal: 2207, protein: 160, fat: 61, carbs: 255 });
  expect(suggestTargets({ ...man, primaryGoal: "GAIN_MUSCLE" }, 80, "2026-10-28", 1.2)?.kcal).toBe(2350); // 1780 × 1.2 × 1.1 = 2349.6
  expect(suggestTargets({ ...man, primaryGoal: null }, 80, "2026-10-28", 1.2)?.kcal).toBe(2136);
  // Female −161; race@: age 36 → 584 + 1068.75 − 180 − 161 = 1311.75; × 1.725 = 2262.8
  const woman = { sex: "FEMALE", birthDate: "1990-01-22", heightCm: 171, primaryGoal: "COMPETITION_PREP" };
  expect(suggestTargets(woman, 58.4, "2026-10-28", 1.725)).toEqual({ kcal: 2263, protein: 117, fat: 63, carbs: 307 });
});

test("no suggestion without sex, birth date, height or weight", () => {
  const full = { sex: "MALE", birthDate: "1996-05-01", heightCm: 180, primaryGoal: null };
  for (const missing of [{ sex: null }, { birthDate: null }, { heightCm: null }]) expect(suggestTargets({ ...full, ...missing }, 80, "2026-10-28", 1.2)).toBeNull();
  expect(suggestTargets(full, null, "2026-10-28", 1.2)).toBeNull();
});

test("fluid: 35 ml/kg to the nearest 50 ml", () => {
  expect(suggestFluid(70)).toBe(2450);
  expect(suggestFluid(58.4)).toBe(2050); // 2044
  expect(suggestFluid(94.5)).toBe(3300); // 3307.5
  expect(suggestFluid(null)).toBeNull();
});
