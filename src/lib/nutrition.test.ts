import { expect, test } from "vitest";
import { dayType } from "./nutrition";

test("dayType: override > competition > session > REST", () => {
  expect(dayType({})).toBe("REST");
  expect(dayType({ session: true })).toBe("TRAINING");
  expect(dayType({ competition: true, session: true })).toBe("COMPETITION");
  expect(dayType({ override: "REST", competition: true, session: true })).toBe("REST");
  expect(dayType({ override: "TRAINING" })).toBe("TRAINING");
  expect(dayType({ override: null, session: true })).toBe("TRAINING");
});
