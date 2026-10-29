import type { CheckIn, CoachNote, HistoryEvent } from "@/generated/prisma/client";
import { HISTORY_TYPES, NOTE_TYPES } from "./enums";

// The coach's client history (coach.md): notes, HistoryEvents and check-ins (with their feedback) in one feed, newest
// day first, and the pinned notes in their own block above it. Competitions join as a source when they land.
export const FEED_TYPES = [...NOTE_TYPES, ...HISTORY_TYPES, "CHECK_IN"] as const;
export type FeedType = (typeof FEED_TYPES)[number];
export type FeedCheckIn = Pick<CheckIn, "id" | "dueDate" | "createdAt" | "reviewedAt" | "response">;
export type FeedItem = { type: FeedType; date: string; createdAt: Date } & ({ note: CoachNote } | { event: HistoryEvent } | { checkIn: FeedCheckIn });

const newest = (a: { date: string; createdAt: Date }, b: { date: string; createdAt: Date }) =>
  b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime();

export function historyFeed(notes: CoachNote[], events: HistoryEvent[], checkIns: FeedCheckIn[], type?: FeedType) {
  const items: FeedItem[] = [
    ...notes.filter((note) => !note.pinned).map((note) => ({ type: note.type as FeedType, date: note.date, createdAt: note.createdAt, note })),
    ...events.map((event) => ({ type: event.type as FeedType, date: event.date, createdAt: event.createdAt, event })),
    ...checkIns.map((checkIn) => ({ type: "CHECK_IN" as const, date: checkIn.dueDate, createdAt: checkIn.createdAt, checkIn })),
  ];
  return {
    pinned: notes.filter((note) => note.pinned && (!type || note.type === type)).sort(newest),
    feed: items.filter((item) => !type || item.type === type).sort(newest),
  };
}
