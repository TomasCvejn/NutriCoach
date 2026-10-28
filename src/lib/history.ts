import type { CoachNote, HistoryEvent } from "@/generated/prisma/client";
import { HISTORY_TYPES, NOTE_TYPES } from "./enums";

// The coach's client history (coach.md): notes and HistoryEvents in one feed, newest day first, and the pinned notes in
// their own block above it. Check-ins and competitions join as sources when they land.
export const FEED_TYPES = [...NOTE_TYPES, ...HISTORY_TYPES] as const;
export type FeedType = (typeof FEED_TYPES)[number];
export type FeedItem = { type: FeedType; date: string; createdAt: Date } & ({ note: CoachNote } | { event: HistoryEvent });

const newest = (a: { date: string; createdAt: Date }, b: { date: string; createdAt: Date }) =>
  b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime();

export function historyFeed(notes: CoachNote[], events: HistoryEvent[], type?: FeedType) {
  const items: FeedItem[] = [
    ...notes.filter((note) => !note.pinned).map((note) => ({ type: note.type as FeedType, date: note.date, createdAt: note.createdAt, note })),
    ...events.map((event) => ({ type: event.type as FeedType, date: event.date, createdAt: event.createdAt, event })),
  ];
  return {
    pinned: notes.filter((note) => note.pinned && (!type || note.type === type)).sort(newest),
    feed: items.filter((item) => !type || item.type === type).sort(newest),
  };
}
