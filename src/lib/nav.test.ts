import { expect, test } from "vitest";
import { clientNav, coachNav } from "./nav";

const keys = (items: { key: string }[]) => items.map((item) => item.key);

test("clientNav: Training is a tab only when the client trains", () => {
  expect(keys(clientNav({ training: false, competition: false }).tabs)).toEqual(["today", "nutrition"]);
  expect(keys(clientNav({ training: true, competition: false }).tabs)).toEqual(["today", "nutrition", "training"]);
  // A competition alone doesn't bring the Training tab.
  expect(keys(clientNav({ training: false, competition: true }).tabs)).toEqual(["today", "nutrition"]);
});

test("clientNav: plan, profile and settings under More", () => {
  expect(keys(clientNav({ training: false, competition: false }).more)).toEqual(["plan", "profile", "settings"]);
});

test("the bottom bar holds at most 4 tabs besides More", () => {
  expect(clientNav({ training: true, competition: true }).tabs.length).toBeLessThanOrEqual(4);
  expect(coachNav.tabs.length).toBeLessThanOrEqual(4);
});
