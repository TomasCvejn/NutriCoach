import { expect, test } from "vitest";
import { db, dbUrl } from "./db";

test("shared client talks to the test database", async () => {
  expect(dbUrl).toBe("file:./test.db");
  const [row] = await db.$queryRaw<{ one: bigint }[]>`SELECT 1 AS one`;
  expect(Number(row.one)).toBe(1);
});
