import { expect, test } from "vitest";
import { addDays, diffDays, todayIn, weekday } from "./dates";

test("addDays crosses months, years and leap days", () => {
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  expect(addDays("2026-10-25", 0)).toBe("2026-10-25");
});

test("todayIn follows the timezone where the UTC date differs", () => {
  const lateEvening = new Date("2026-10-28T23:30:00Z");
  expect(todayIn("UTC", lateEvening)).toBe("2026-10-28");
  expect(todayIn("Europe/Prague", lateEvening)).toBe("2026-10-29");
  expect(todayIn("Pacific/Kiritimati", new Date("2026-12-31T10:00:00Z"))).toBe("2027-01-01"); // UTC+14
  expect(todayIn("America/Los_Angeles", new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-27");
});

test("a DST week: Prague's midnight moves from 22:00 to 23:00 UTC, days stay whole", () => {
  // Summer time ends on Sunday 2026-10-25.
  expect(todayIn("Europe/Prague", new Date("2026-10-24T22:00:00Z"))).toBe("2026-10-25"); // 00:00 CEST
  expect(todayIn("Europe/Prague", new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25"); // 23:30 CET
  expect(todayIn("Europe/Prague", new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26"); // 00:00 CET
  // Spring: summer time starts on Sunday 2026-03-29.
  expect(todayIn("Europe/Prague", new Date("2026-03-28T23:00:00Z"))).toBe("2026-03-29"); // 00:00 CET
  expect(todayIn("Europe/Prague", new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30"); // 00:00 CEST

  const days = Array.from({ length: 7 }, (_, i) => addDays("2026-10-19", i));
  expect(days.map(weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(addDays("2026-10-19", 7)).toBe("2026-10-26");
  expect(diffDays("2026-10-19", "2026-10-26")).toBe(7);
  expect(diffDays("2026-03-23", "2026-03-30")).toBe(7);
});

test("weekday and diffDays", () => {
  expect(weekday("2026-10-28")).toBe(3); // Wednesday
  expect(weekday("2026-11-01")).toBe(7); // Sunday
  expect(diffDays("2026-10-28", "2026-10-28")).toBe(0);
  expect(diffDays("2026-10-28", "2026-10-21")).toBe(-7);
  expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
});
