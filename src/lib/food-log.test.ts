import { expect, test } from "vitest";
import { micronutrientTotals, nutrientsOf, rescale, totals } from "./food-log";

const skyr = { kcal: 63, protein: 11, carbs: 4, fat: 0.2, sodium: 40, fiber: null };

test("an amount's nutrients: per 100 g scaled to the grams, missing micronutrients stay missing", () => {
  expect(nutrientsOf(skyr, 150)).toMatchObject({ kcal: 94.5, protein: 16.5, carbs: 6, fat: 0.3, sodium: 60, fiber: null });
  expect(nutrientsOf(skyr, 0.5)).toMatchObject({ kcal: 0.32, fat: 0 });
});

test("a new amount scales the entry's own snapshot", () => {
  const logged = nutrientsOf(skyr, 150);
  expect(rescale(logged, 150, 300)).toMatchObject({ kcal: 189, protein: 33, sodium: 120, fiber: null });
  expect(rescale(logged, 150, 50)).toMatchObject({ kcal: 31.5, protein: 5.5 });
});

test("totals as shown: whole kcal, one decimal for grams", () => {
  expect(totals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(totals([nutrientsOf(skyr, 150), { kcal: 700.4, protein: 40.04, carbs: 80, fat: 22 }])).toEqual({ kcal: 795, protein: 56.5, carbs: 86, fat: 22.3 });
});

test("fiber and sodium totals sum what the entries have and count the entries without a value", () => {
  const day = [nutrientsOf(skyr, 150), nutrientsOf({ ...skyr, sodium: 120, fiber: 2 }, 100), { kcal: 650, protein: 35, carbs: 70, fat: 20 }];
  const micro = micronutrientTotals(day);
  expect(micro.sodium).toEqual({ total: 180, missing: 1 }); // 60 + 120; the quick add has none
  expect(micro.fiber).toEqual({ total: 2, missing: 2 });
  expect(micronutrientTotals([]).sodium).toEqual({ total: 0, missing: 0 });
});
