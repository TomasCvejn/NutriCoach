import { PACKING_GROUPS, type PackingGroup, TIMELINE_PHASES, type TimelinePhase } from "./enums";

// A competition's timeline (competition.md), stored as JSON on the competition: each phase's nutrition priorities and
// tasks, and the race-day packing list. Ticks live on the items.
export type Item = { id: string; text: string; done: boolean };
export type Timeline = { phases: Partial<Record<TimelinePhase, { priorities: string; tasks: Item[] }>>; packing: (Item & { group: PackingGroup })[] };
// A template holds the texts only.
export type TimelineContent = { phases: Partial<Record<TimelinePhase, { priorities: string; tasks: string[] }>>; packing: { group: PackingGroup; text: string }[] };

export const timelineOf = (json: unknown): Timeline => ({ phases: {}, packing: [], ...(json as Partial<Timeline>) });
export const isEmpty = (timeline: Timeline) => timeline.packing.length === 0 && Object.values(timeline.phases).every((p) => !p.priorities && p.tasks.length === 0);
const item = (text: string): Item => ({ id: crypto.randomUUID(), text, done: false });

// A template applied to a competition: a copy with new ids and nothing ticked.
export const fromContent = (content: TimelineContent): Timeline => ({
  phases: Object.fromEntries(Object.entries(content.phases).map(([phase, p]) => [phase, { priorities: p.priorities, tasks: p.tasks.map(item) }])),
  packing: content.packing.map((p) => ({ ...item(p.text), group: p.group })),
});

// A competition's timeline saved as a template: the texts without the ticks.
export const toContent = (timeline: Timeline): TimelineContent => ({
  phases: Object.fromEntries(Object.entries(timeline.phases).map(([phase, p]) => [phase, { priorities: p.priorities, tasks: p.tasks.map((t) => t.text) }])),
  packing: timeline.packing.map(({ group, text }) => ({ group, text })),
});

// The coach's editor: per phase the priorities and the tasks one per line, per packing group one item per line. An item
// whose text was there before keeps its id and its tick.
export function fromLines(lines: { priorities: Partial<Record<TimelinePhase, string>>; tasks: Partial<Record<TimelinePhase, string>>; packing: Partial<Record<PackingGroup, string>> }, previous: Timeline): Timeline {
  const split = (text = "") => [...new Set(text.split("\n").map((line) => line.trim()).filter(Boolean))];
  const keep = (old: Item[], text: string) => old.find((i) => i.text === text) ?? item(text);
  return {
    phases: Object.fromEntries(
      TIMELINE_PHASES.flatMap((phase) => {
        const priorities = lines.priorities[phase]?.trim() ?? "";
        const tasks = split(lines.tasks[phase]).map((text) => keep(previous.phases[phase]?.tasks ?? [], text));
        return priorities || tasks.length ? [[phase, { priorities, tasks }]] : [];
      }),
    ),
    packing: PACKING_GROUPS.flatMap((group) =>
      split(lines.packing[group]).map((text) => ({
        ...keep(
          previous.packing.filter((p) => p.group === group),
          text,
        ),
        group,
      })),
    ),
  };
}

// Tick or untick one task or packing item; null when there is no such item.
export function tick(timeline: Timeline, id: string, done: boolean): Timeline | null {
  const all = [...Object.values(timeline.phases).flatMap((p) => p.tasks), ...timeline.packing];
  if (!all.some((i) => i.id === id)) return null;
  const set = <T extends Item>(i: T) => (i.id === id ? { ...i, done } : i);
  return {
    phases: Object.fromEntries(Object.entries(timeline.phases).map(([phase, p]) => [phase, { ...p, tasks: p.tasks.map(set) }])),
    packing: timeline.packing.map(set),
  };
}
