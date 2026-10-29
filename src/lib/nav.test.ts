import { expect, test } from "vitest";
import { clientNav, coachNav } from "./nav";

const keys = (items: { key: string }[]) => items.map((item) => item.key);

test("clientNav: Training is a tab only when the client trains", () => {
  expect(keys(clientNav({ training: false, competition: false }).tabs)).toEqual(["today", "nutrition"]);
  expect(keys(clientNav({ training: true, competition: false }).tabs)).toEqual(["today", "nutrition", "training"]);
  // A competition alone doesn't bring the Training tab.
  expect(keys(clientNav({ training: false, competition: true }).tabs)).toEqual(["today", "nutrition"]);
});

test("clientNav: plan, recipes, hydration, progress, supplements, check-in, profile and settings under More", () => {
  expect(keys(clientNav({ training: false, competition: false }).more)).toEqual(["plan", "recipes", "hydration", "progress", "supplements", "checkIn", "profile", "settings"]);
});

test("coachNav: Overview, Clients and Check-ins as tabs; Library and Settings under More", () => {
  expect(keys(coachNav.tabs)).toEqual(["overview", "clients", "checkIns"]);
  expect(keys(coachNav.more)).toEqual(["library", "settings"]);
});

test("clientNav: Competition leads the More sheet only with an upcoming or recent competition", () => {
  expect(keys(clientNav({ training: true, competition: true }).more)[0]).toBe("competition");
  expect(keys(clientNav({ training: true, competition: false }).more)).not.toContain("competition");
});

test("the bottom bar holds at most 4 tabs besides More", () => {
  expect(clientNav({ training: true, competition: true }).tabs.length).toBeLessThanOrEqual(4);
  expect(coachNav.tabs.length).toBeLessThanOrEqual(4);
});
