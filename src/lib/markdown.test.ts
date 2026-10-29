import { expect, test } from "vitest";
import { markdownBlocks } from "./markdown";

test("headings, list items and paragraphs; a paragraph's lines join", () => {
  expect(markdownBlocks("# Title\n\nFirst line\nsecond line.\n\n## Part\n\n- one\n- two\n")).toEqual([
    { type: "h1", text: "Title" },
    { type: "p", text: "First line second line." },
    { type: "h2", text: "Part" },
    { type: "ul", items: ["one", "two"] },
  ]);
});
