import { expect, test } from "vitest";
import { clientFeatures } from "./features";

const none = { hasSport: false, hasSession: false, lastCompetitionDate: null };

test("no sport, no session, no competition: nothing beyond the basics", () => {
  expect(clientFeatures(none, "2026-10-27")).toEqual({ training: false, competition: false });
});

test("training: a sport on the profile or any session", () => {
  expect(clientFeatures({ ...none, hasSport: true }, "2026-10-27")).toEqual({ training: true, competition: false });
  expect(clientFeatures({ ...none, hasSession: true }, "2026-10-27")).toEqual({ training: true, competition: false });
});

test("competition: upcoming, today or within the last 7 days", () => {
  const competition = (date: string) => clientFeatures({ ...none, lastCompetitionDate: date }, "2026-11-03").competition;
  expect(competition("2027-05-01")).toBe(true);
  expect(competition("2026-11-03")).toBe(true);
  expect(competition("2026-10-27")).toBe(true); // 7 days ago, across the month boundary
  expect(competition("2026-10-26")).toBe(false); // 8 days ago
  // A competition alone doesn't turn on training.
  expect(clientFeatures({ ...none, lastCompetitionDate: "2026-11-10" }, "2026-11-03").training).toBe(false);
});
