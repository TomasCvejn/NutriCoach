import { expect, test } from "vitest";
import { leanMass, withDeltas } from "./body-comp";
import { BODY_FIELDS } from "./enums";

const none = Object.fromEntries(BODY_FIELDS.map((f) => [f, null])) as Record<(typeof BODY_FIELDS)[number], number | null>;

test("lean mass: as entered, else weight × (1 − body fat %), else none", () => {
  expect(leanMass({ weightKg: 80, bodyFatPct: 20, leanMassKg: 65 })).toBe(65);
  expect(leanMass({ weightKg: 61.2, bodyFatPct: 18.5, leanMassKg: null })).toBe(49.9); // 49.878
  expect(leanMass({ weightKg: 61.2, bodyFatPct: null, leanMassKg: null })).toBeNull();
});

test("Δ against the latest earlier entry with that value; the first entry and missing values have none", () => {
  const rows = withDeltas([
    { ...none, weightKg: 62, bodyFatPct: 20 },
    { ...none, waistCm: 70 }, // tape only
    { ...none, weightKg: 61.2, bodyFatPct: 19.5, waistCm: 69.5 },
  ]);
  expect(rows[0].delta).toEqual(none);
  expect(rows[1].delta).toEqual(none);
  expect(rows[2].delta).toMatchObject({ weightKg: -0.8, bodyFatPct: -0.5, waistCm: -0.5, leanMassKg: -0.3, hipsCm: null }); // lean 49.6 → 49.3
  expect(rows[2].values.leanMassKg).toBe(49.3);
});
