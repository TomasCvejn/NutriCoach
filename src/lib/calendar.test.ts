import { expect, test } from "vitest";
import { calendarItems } from "./calendar";

const session = (date: string, startTime: string | null) => ({ id: `s-${date}`, clientId: "c1", date, startTime, type: "RUN", sport: null, durationMin: 60 });

test("sessions, competitions, calls in the viewer's timezone and weekly check-in days, in the range, by day and time", () => {
  const items = calendarItems({
    from: "2026-10-26", // a Monday
    to: "2026-11-01",
    timezone: "Europe/Prague",
    sessions: [session("2026-10-28", "17:30"), session("2026-10-28", null), session("2026-11-02", "06:00")],
    competitions: [{ id: "race", clientId: "c2", date: "2026-11-01", name: "Maraton" }],
    // 23:30 UTC on the 31st is already 1 November at 00:30 in Prague (winter time).
    calls: [{ id: "call", clientId: "c1", startsAt: new Date("2026-10-31T23:30:00Z"), durationMin: 30, link: null, agenda: null }],
    checkIns: [
      { clientId: "c1", weekday: 1, since: "2026-10-01" },
      { clientId: "c2", weekday: 3, since: "2026-10-29" }, // starts after this week's Wednesday
      { clientId: "c3", weekday: 5, since: null }, // still onboarding
    ],
  });
  expect(items.map((i) => [i.date, i.time, i.type, i.clientId])).toEqual([
    ["2026-10-26", null, "CHECK_IN", "c1"],
    ["2026-10-28", null, "SESSION", "c1"],
    ["2026-10-28", "17:30", "SESSION", "c1"],
    ["2026-11-01", null, "COMPETITION", "c2"],
    ["2026-11-01", "00:30", "CALL", "c1"],
  ]);
});
