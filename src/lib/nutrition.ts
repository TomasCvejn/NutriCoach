import type { DayType } from "./enums";

// Day type of a date (00-overview.md): an override wins, then a competition that day, then any training session, else REST.
export function dayType({ override, competition, session }: { override?: DayType | null; competition?: boolean; session?: boolean }): DayType {
  return override ?? (competition ? "COMPETITION" : session ? "TRAINING" : "REST");
}
