import { expect, test } from "vitest";
import { dailyFluidTarget, duringTotals, fuelingFor } from "./fueling";

const template = (id: string, rule: Partial<{ sessionTypes: string[]; minDurationMin: number; maxDurationMin: number; minIntensity: string; priority: number }>) => ({
  ...{ id, name: id, sessionTypes: [] as string[], minDurationMin: null, maxDurationMin: null, minIntensity: null, priority: 0 },
  ...rule,
});
const session = (durationMin: number, intensity = "MODERATE", type = "RUN") => ({ type, durationMin, intensity });

// The seeded set (training.md).
const short = template("short", { maxDurationMin: 74, priority: 1 });
const middle = template("middle", { minDurationMin: 75, maxDurationMin: 150, priority: 1 });
const long = template("long", { minDurationMin: 151, priority: 2 });
const hard = template("hard", { minIntensity: "VERY_HIGH", priority: 2 });
const seeded = [short, middle, long, hard];
const id = (s: ReturnType<typeof session>, override: string | null = null) => fuelingFor(s, seeded, override)?.id ?? null;

test("inclusive duration bounds pick the template", () => {
  expect(id(session(74))).toBe("short");
  expect(id(session(75))).toBe("middle");
  expect(id(session(150))).toBe("middle");
  expect(id(session(151))).toBe("long");
});

test("intensity order: the minimum or above matches; priority beats an earlier match", () => {
  expect(id(session(60, "HIGH"))).toBe("short");
  expect(id(session(60, "VERY_HIGH"))).toBe("hard"); // short matches too, hard has the higher priority
  expect(id(session(200, "VERY_HIGH"))).toBe("hard"); // long and hard tie: by name
});

test("session types: empty means any; a listed type limits it; no match → none", () => {
  const swim = template("swim", { sessionTypes: ["SWIM"], priority: 5 });
  expect(fuelingFor(session(60, "LOW", "SWIM"), [short, swim], null)?.id).toBe("swim");
  expect(fuelingFor(session(60, "LOW", "BIKE"), [short, swim], null)?.id).toBe("short");
  expect(fuelingFor(session(90, "LOW", "BIKE"), [short, swim], null)).toBeNull();
});

test("the coach's override wins, even over a better match", () => {
  expect(id(session(200, "VERY_HIGH"), "short")).toBe("short");
  expect(id(session(60), "deleted")).toBeNull();
});

test("during totals: per hour × duration", () => {
  expect(duringTotals({ duringCarbsPerHour: 45, duringFluidPerHour: 500, duringSodiumPerHour: 400 }, 90)).toEqual({ carbs: 68, fluidMl: 750, sodiumMg: 600 }); // 67.5 → 68
  expect(duringTotals({ duringCarbsPerHour: 0, duringFluidPerHour: null, duringSodiumPerHour: null }, 45)).toEqual({ carbs: 0, fluidMl: null, sodiumMg: null });
});

test("daily fluid target: the base, plus the sessions' fluid on training and competition days only", () => {
  expect(dailyFluidTarget(2150, "TRAINING", [750, null, 300])).toBe(3200);
  expect(dailyFluidTarget(2150, "COMPETITION", [900])).toBe(3050);
  expect(dailyFluidTarget(2150, "REST", [750])).toBe(2150); // overridden to a rest day: the session's fluid doesn't count
  expect(dailyFluidTarget(2150, "TRAINING", [])).toBe(2150);
  expect(dailyFluidTarget(null, "TRAINING", [750])).toBeNull();
});
