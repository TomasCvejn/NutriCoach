import { expect, test } from "vitest";
import type { CoachNote, HistoryEvent } from "@/generated/prisma/client";
import { historyFeed } from "./history";

const at = (iso: string) => new Date(iso);
const note = (id: string, date: string, type: string, pinned = false, createdAt = at(`${date}T09:00:00Z`)) =>
  ({ id, clientId: "c", date, type, text: id, pinned, createdAt, updatedAt: createdAt }) as CoachNote;
const event = (id: string, date: string, createdAt: Date) => ({ id, clientId: "c", date, type: "TRACKING_MODE", payload: {}, createdAt }) as HistoryEvent;

const notes = [note("old", "2026-10-01", "NOTE"), note("pin", "2026-10-03", "DECISION", true), note("late", "2026-10-05", "NOTE", false, at("2026-10-05T18:00:00Z")), note("decided", "2026-10-02", "DECISION")];
const events = [event("switch", "2026-10-05", at("2026-10-05T10:00:00Z"))];
const ids = (items: { note?: CoachNote; event?: HistoryEvent }[]) => items.map((i) => (i.note ?? i.event)!.id);

test("one feed of notes and history, newest day first and the later entry first within a day; pinned notes only on top", () => {
  const { pinned, feed } = historyFeed(notes, events);
  expect(pinned.map((n) => n.id)).toEqual(["pin"]);
  expect(ids(feed)).toEqual(["late", "switch", "decided", "old"]);
});

test("the type filter applies to the pinned block and the feed", () => {
  expect(historyFeed(notes, events, "DECISION")).toMatchObject({ pinned: [{ id: "pin" }], feed: [{ note: { id: "decided" } }] });
  const modes = historyFeed(notes, events, "TRACKING_MODE");
  expect(modes.pinned).toEqual([]);
  expect(ids(modes.feed)).toEqual(["switch"]);
  expect(historyFeed([], [])).toEqual({ pinned: [], feed: [] });
});
