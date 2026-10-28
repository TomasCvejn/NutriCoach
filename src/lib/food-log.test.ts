import { expect, test } from "vitest";
import { nutrientsOf, rescale, totals } from "./food-log";

const skyr = { kcal: 63, protein: 11, carbs: 4, fat: 0.2, calcium: 110, fiber: null };

test("an amount's nutrients: per 100 g scaled to the grams, missing micronutrients stay missing", () => {
  expect(nutrientsOf(skyr, 150)).toMatchObject({ kcal: 94.5, protein: 16.5, carbs: 6, fat: 0.3, calcium: 165, fiber: null, iron: null });
  expect(nutrientsOf(skyr, 0.5)).toMatchObject({ kcal: 0.32, fat: 0 });
});

test("a new amount scales the entry's own snapshot", () => {
  const logged = nutrientsOf(skyr, 150);
  expect(rescale(logged, 150, 300)).toMatchObject({ kcal: 189, protein: 33, calcium: 330, fiber: null });
  expect(rescale(logged, 150, 50)).toMatchObject({ kcal: 31.5, protein: 5.5 });
});

test("totals as shown: whole kcal, one decimal for grams", () => {
  expect(totals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(totals([nutrientsOf(skyr, 150), { kcal: 700.4, protein: 40.04, carbs: 80, fat: 22 }])).toEqual({ kcal: 795, protein: 56.5, carbs: 86, fat: 22.3 });
});
