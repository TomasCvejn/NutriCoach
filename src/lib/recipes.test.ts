import { expect, test } from "vitest";
import { recipeNutrition } from "./recipes";

const foods = new Map([
  ["oats", { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, fiber: 10, sodium: null }],
  ["banana", { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sodium: 1 }],
]);

test("a recipe's nutrition in total and per portion from its foods", () => {
  const n = recipeNutrition(
    [
      { foodId: "oats", name: "Vločky", grams: 80 },
      { foodId: "banana", name: "Banán", grams: 120 },
    ],
    foods,
    2,
  );
  expect(n.incomplete).toBe(false);
  expect(n.total).toMatchObject({ kcal: 404.4, protein: 12.1, carbs: 74.3, fat: 6, fiber: 11.1, sodium: 1.2 });
  expect(n.perPortion).toMatchObject({ kcal: 202.2, protein: 6.1, carbs: 37.2, fat: 3 });
});

test("a free-text ingredient, a missing amount or a deleted food makes the nutrition incomplete", () => {
  const oats = { foodId: "oats", name: "Vločky", grams: 100 };
  expect(recipeNutrition([oats, { name: "Špetka skořice" }], foods, 1)).toMatchObject({ incomplete: true, total: { kcal: 372 } });
  expect(recipeNutrition([oats, { foodId: "banana", name: "Banán" }], foods, 1).incomplete).toBe(true);
  expect(recipeNutrition([oats, { foodId: "gone", name: "Smazaná", grams: 50 }], foods, 1).incomplete).toBe(true);
  expect(recipeNutrition([], foods, 4)).toMatchObject({ incomplete: false, perPortion: { kcal: 0 } });
});
