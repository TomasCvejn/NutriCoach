import { expect, test } from "vitest";
import { fromContent, fromLines, tick, toContent } from "./timeline";

const content = {
  phases: { "2_WEEKS": { priorities: "Carbs on long days", tasks: ["Practice race breakfast", "Test gels"] } },
  packing: [{ group: "FOOD" as const, text: "Gels ×6" }],
};

test("a template becomes a fresh timeline (new ids, nothing ticked) and back to the same texts", () => {
  const timeline = fromContent(content);
  expect(timeline.phases["2_WEEKS"]!.tasks).toMatchObject([
    { text: "Practice race breakfast", done: false },
    { text: "Test gels", done: false },
  ]);
  expect(fromContent(content).phases["2_WEEKS"]!.tasks[0].id).not.toBe(timeline.phases["2_WEEKS"]!.tasks[0].id);
  expect(toContent(timeline)).toEqual(content);
});

test("ticking an item; the editor's lines keep ticks of unchanged texts and drop blank lines and doubles", () => {
  const ticked = tick(fromContent(content), fromContent(content).phases["2_WEEKS"]!.tasks[0].id, true);
  expect(ticked).toBeNull(); // another copy's id

  const timeline = fromContent(content);
  const done = tick(timeline, timeline.phases["2_WEEKS"]!.tasks[1].id, true)!;
  expect(done.phases["2_WEEKS"]!.tasks.map((t) => t.done)).toEqual([false, true]);

  const edited = fromLines({ priorities: { "2_WEEKS": " Carbs on long days " }, tasks: { "2_WEEKS": "Test gels\n\nNew task\nNew task", RACE_DAY: "" }, packing: { FOOD: "Gels ×6\n", OTHER: "Bib" } }, done);
  expect(edited.phases).toEqual({
    "2_WEEKS": {
      priorities: "Carbs on long days",
      tasks: [done.phases["2_WEEKS"]!.tasks[1], { id: expect.any(String), text: "New task", done: false }],
    },
  });
  expect(edited.packing).toMatchObject([
    { group: "FOOD", text: "Gels ×6", id: done.packing[0].id },
    { group: "OTHER", text: "Bib", done: false },
  ]);
});
