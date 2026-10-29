import { expect, test } from "vitest";
import { competitionPhase, nextCompetition } from "./competition";
import { addDays } from "./dates";

const date = "2026-11-08";
const phaseAt = (daysBefore: number) => competitionPhase(addDays(date, -daysBefore), date);

test("the phase by days to go, at every boundary", () => {
  expect([29, 28, 15, 14, 8, 7, 2, 1, 0, -1].map(phaseAt)).toEqual([
    "BASE",
    "4_WEEKS",
    "4_WEEKS",
    "2_WEEKS",
    "2_WEEKS",
    "RACE_WEEK",
    "RACE_WEEK",
    "DAY_BEFORE",
    "RACE_DAY",
    null,
  ]);
});

test("the next competition is the nearest from today on, today's included", () => {
  const competitions = [{ date: "2026-12-01" }, { date: "2026-10-01" }, { date: "2026-11-08" }];
  expect(nextCompetition(competitions, "2026-10-29")).toEqual({ date: "2026-11-08" });
  expect(nextCompetition(competitions, "2026-11-08")).toEqual({ date: "2026-11-08" });
  expect(nextCompetition(competitions, "2026-12-02")).toBeNull();
});
