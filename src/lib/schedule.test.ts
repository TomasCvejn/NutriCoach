import { expect, test } from "vitest";
import { betweenEvents, ordered, shift, totals } from "./schedule";

const item = (time: string, type: string, amounts: Partial<Record<"carbs" | "fluid" | "sodium" | "caffeine", number>> = {}, position = 0) => ({
  ...{ time, type, position, carbs: null, fluid: null, sodium: null, caffeine: null },
  ...amounts,
});

const day = [
  item("06:00", "MEAL", { carbs: 120, fluid: 500 }),
  item("09:00", "EVENT"),
  item("09:45", "RECOVERY", { carbs: 30, fluid: 400, sodium: 300 }),
  item("10:30", "CARBS", { carbs: 25, caffeine: 75 }),
  item("11:00", "EVENT"),
  item("11:30", "HYDRATION", { fluid: 500 }, 1),
  item("11:30", "SNACK", { carbs: 40 }, 0),
  item("13:00", "EVENT"),
];

test("the day's totals and the totals between consecutive events", () => {
  expect(totals(day)).toEqual({ carbs: 215, fluid: 1400, sodium: 300, caffeine: 75 });
  expect(betweenEvents(day)).toEqual([
    { after: 1, totals: { carbs: 55, fluid: 400, sodium: 300, caffeine: 75 } },
    { after: 4, totals: { carbs: 40, fluid: 500, sodium: 0, caffeine: 0 } },
  ]);
  expect(betweenEvents([item("09:00", "EVENT")])).toEqual([]);
  expect(ordered(day).map((i) => i.type).slice(5, 7)).toEqual(["SNACK", "HYDRATION"]); // same time: by position
});

test("shifting moves every item and refuses to leave the day", () => {
  expect(shift(day, 15)!.map((i) => i.time)).toEqual(["06:15", "09:15", "10:00", "10:45", "11:15", "11:45", "11:45", "13:15"]);
  expect(shift(day, -360)![0].time).toBe("00:00");
  expect(shift(day, -361)).toBeNull();
  expect(shift([item("23:30", "EVENT")], 29)![0].time).toBe("23:59");
  expect(shift([item("23:30", "EVENT")], 30)).toBeNull();
});
