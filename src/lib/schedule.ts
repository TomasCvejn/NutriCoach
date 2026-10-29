// The race-day schedule (competition.md): items at times of one day, with optional carbs / fluid / sodium / caffeine.
type Item = { time: string; position: number; type: string; carbs: number | null; fluid: number | null; sodium: number | null; caffeine: number | null };
export const AMOUNTS = ["carbs", "fluid", "sodium", "caffeine"] as const;
export type Totals = Record<(typeof AMOUNTS)[number], number>;

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// The day's order: by time, then by position among items at the same time.
export const ordered = <T extends Pick<Item, "time" | "position">>(items: T[]) => items.toSorted((a, b) => a.time.localeCompare(b.time) || a.position - b.position);

export const totals = (items: Item[]): Totals => Object.fromEntries(AMOUNTS.map((key) => [key, items.reduce((sum, i) => sum + (i[key] ?? 0), 0)])) as Totals;

// Between each two consecutive events: what the items after the first and before the next add up to (the fueling
// between heats). `after` is the index of the earlier event in the ordered list.
export function betweenEvents<T extends Item>(items: T[]) {
  const list = ordered(items);
  const events = list.flatMap((item, i) => (item.type === "EVENT" ? [i] : []));
  return events.slice(0, -1).map((start, n) => ({ after: start, totals: totals(list.slice(start + 1, events[n + 1])) }));
}

// Every item moved by `minutes`; null when one would leave the day (00:00–23:59).
export function shift<T extends Pick<Item, "time">>(items: T[], minutes: number): (T & { time: string })[] | null {
  const moved = items.map((item) => ({ item, at: toMinutes(item.time) + minutes }));
  if (moved.some(({ at }) => at < 0 || at > 23 * 60 + 59)) return null;
  return moved.map(({ item, at }) => ({ ...item, time: fromMinutes(at) }));
}
