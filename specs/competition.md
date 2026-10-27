# Competitions (COMPETITION program)

## Competition
- Coach creates; client views. Name, date, sport/discipline, location, priority (A / B / C), notes.
- After: result (time / placing / text), "how it felt" 1–10 → Performance in `progress.md`.
- A client can have several; "next competition" = nearest upcoming.

## Timeline
- Phases by days before the competition: `4_WEEKS` (28–15), `2_WEEKS` (14–8), `RACE_WEEK` (7–2), `DAY_BEFORE` (1), `RACE_DAY` (0). Earlier = "base", no tasks. Current phase is a pure function of dates (tested).
- Each phase: nutrition priorities (coach text) and a task checklist the client ticks off (e.g. "practice race breakfast before a long session", "start carb loading").
- Race day additionally: packing checklist grouped Food / Hydration / Supplements / Other.
- Timeline templates in the coach library: save a competition's timeline as a template, apply a template to a new competition. One seeded default (cs + en).

## Competition dashboard (client; also a client-home widget)
Countdown (days; hours on race day), current phase with its nutrition priorities, open tasks of the current and next phase, links to timeline and race-day schedule.

## Competition-day schedule
- Items ordered by time (HH:MM): type `EVENT` (race / heat / match), `MEAL`, `SNACK`, `CARBS` (gel / bar / drink), `HYDRATION`, `RECOVERY` (between events), `SUPPLEMENT`, `OTHER`; title, details; optional carbs g, fluid ml, sodium mg, caffeine mg; optional link to a recipe or supplement.
- Totals of carbs / fluid / sodium / caffeine for the day and between consecutive EVENT items.
- Client view: vertical timeline, "now" marker on race day, items can be ticked as done.

## Competition plan editor (coach)
One page per competition: details, timeline phases (priorities, tasks, packing list), apply a timeline template, race-day schedule builder (add / edit / reorder / duplicate items, "shift all items by ±N minutes").
