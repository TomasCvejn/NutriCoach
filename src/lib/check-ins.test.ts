import { expect, test } from "vitest";
import { checkInStatus, currentDueDate } from "./check-ins";

// 2026-10-26 is a Monday.
test("the period opens on the check-in weekday: due that day and the next, overdue from the second day after", () => {
  const status = (today: string) => checkInStatus(today, currentDueDate(today, 1, "2026-10-01"), null);
  expect(currentDueDate("2026-10-26", 1, "2026-10-01")).toBe("2026-10-26");
  expect(status("2026-10-26")).toBe("due");
  expect(status("2026-10-27")).toBe("due");
  expect(status("2026-10-28")).toBe("overdue");
  expect(currentDueDate("2026-11-01", 1, "2026-10-01")).toBe("2026-10-26"); // Sunday still belongs to Monday's period
  expect(status("2026-11-01")).toBe("overdue");
  expect(currentDueDate("2026-10-29", 4, "2026-10-01")).toBe("2026-10-29"); // a Thursday check-in on a Thursday
});

test("a client who finished onboarding mid-week has no period until their next check-in day", () => {
  expect(currentDueDate("2026-10-29", 1, "2026-10-28")).toBeNull();
  expect(checkInStatus("2026-10-29", null, null)).toBe("ok");
  expect(currentDueDate("2026-11-02", 1, "2026-10-28")).toBe("2026-11-02");
  expect(currentDueDate("2026-10-26", 1, "2026-10-26")).toBe("2026-10-26"); // finished on the check-in day itself
  expect(currentDueDate("2026-10-26", 1, null)).toBeNull(); // still onboarding
});

test("submitted waits for review; reviewed is done", () => {
  expect(checkInStatus("2026-10-30", "2026-10-26", { reviewedAt: null })).toBe("toReview");
  expect(checkInStatus("2026-10-30", "2026-10-26", { reviewedAt: new Date() })).toBe("ok");
});
