import { expect, test } from "vitest";
import type { CoachNote, HistoryEvent } from "@/generated/prisma/client";
import { type FeedCheckIn, type FeedCompetition, historyFeed } from "./history";

const at = (iso: string) => new Date(iso);
const note = (id: string, date: string, type: string, pinned = false, createdAt = at(`${date}T09:00:00Z`)) =>
  ({ id, clientId: "c", date, type, text: id, pinned, createdAt, updatedAt: createdAt }) as CoachNote;
const event = (id: string, date: string, createdAt: Date) => ({ id, clientId: "c", date, type: "TRACKING_MODE", payload: {}, createdAt }) as HistoryEvent;

const notes = [note("old", "2026-10-01", "NOTE"), note("pin", "2026-10-03", "DECISION", true), note("late", "2026-10-05", "NOTE", false, at("2026-10-05T18:00:00Z")), note("decided", "2026-10-02", "DECISION")];
const events = [event("switch", "2026-10-05", at("2026-10-05T10:00:00Z"))];
const checkIns = [{ id: "week", dueDate: "2026-10-04", createdAt: at("2026-10-04T08:00:00Z"), reviewedAt: null, response: null }] satisfies FeedCheckIn[];
const competitions = [{ id: "race", name: "Half", date: "2026-10-03", createdAt: at("2026-09-01T08:00:00Z"), result: "1:39", felt: 8 }] satisfies FeedCompetition[];
const all = { notes, events, checkIns, competitions };
const ids = (items: { note?: CoachNote; event?: HistoryEvent; checkIn?: FeedCheckIn; competition?: FeedCompetition }[]) => items.map((i) => (i.note ?? i.event ?? i.checkIn ?? i.competition)!.id);

test("one feed of notes, history, check-ins and competitions, newest day first and the later entry first within a day; pinned notes only on top", () => {
  const { pinned, feed } = historyFeed(all);
  expect(pinned.map((n) => n.id)).toEqual(["pin"]);
  expect(ids(feed)).toEqual(["late", "switch", "week", "race", "decided", "old"]);
});

test("the type filter applies to the pinned block and the feed", () => {
  expect(historyFeed(all, "DECISION")).toMatchObject({ pinned: [{ id: "pin" }], feed: [{ note: { id: "decided" } }] });
  const modes = historyFeed(all, "TRACKING_MODE");
  expect(modes.pinned).toEqual([]);
  expect(ids(modes.feed)).toEqual(["switch"]);
  expect(ids(historyFeed(all, "CHECK_IN").feed)).toEqual(["week"]);
  expect(ids(historyFeed(all, "COMPETITION").feed)).toEqual(["race"]);
  expect(historyFeed({ notes: [], events: [], checkIns: [], competitions: [] })).toEqual({ pinned: [], feed: [] });
});
