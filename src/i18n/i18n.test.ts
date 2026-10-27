import { createFormatter } from "next-intl";
import { expect, test } from "vitest";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

test("cs and en messages have identical key sets", () => {
  expect(keys(cs).sort()).toEqual(keys(en).sort());
});

test("numbers use the locale format", () => {
  expect(createFormatter({ locale: "cs" }).number(1234.5)).toBe("1 234,5");
  expect(createFormatter({ locale: "en" }).number(1234.5)).toBe("1,234.5");
});
