import { expect, test } from "vitest";
import type { NutritionDay } from "./adherence";
import { weeklyNutrition, weekStarts } from "./progress";

const day = (date: string, adherence: NutritionDay["adherence"], kcal: number | null = null, protein: number | null = null): NutritionDay => ({
  ...{ date, adherence, kcal, protein },
  ...{ kcalTarget: kcal == null ? null : 2000, proteinTarget: kcal == null ? null : 120 },
});

test("weeks start on Monday, the current one last", () => {
  expect(weekStarts("2026-10-29", 3)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]); // a Thursday
  expect(weekStarts("2026-10-26", 1)).toEqual(["2026-10-26"]); // a Monday
});

test("a full week, a partial current week and a week with no data", () => {
  const days = [
    ...["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((d) => day(d, "ADHERENT", 1950, 125)),
    day("2026-10-23", "MISSED", 2600, 90),
    day("2026-10-24", "NOT_LOGGED"),
    day("2026-10-25", null), // no target that day: left out
    day("2026-10-26", "ADHERENT", 2010, 118), // the current week so far: Monday and Tuesday
    day("2026-10-27", "MISSED", 1500, 80),
  ];
  expect(weeklyNutrition(days, ["2026-10-12", "2026-10-19", "2026-10-26"])).toEqual([
    { start: "2026-10-12", adherence: null, kcal: null, kcalTarget: null, protein: null, proteinTarget: null },
    { start: "2026-10-19", adherence: 67, kcal: 2080, kcalTarget: 2000, protein: 118, proteinTarget: 120 }, // 4 of 6; (4 × 1950 + 2600) / 5
    { start: "2026-10-26", adherence: 50, kcal: 1755, kcalTarget: 2000, protein: 99, proteinTarget: 120 },
  ]);
});
