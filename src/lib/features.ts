import { addDays } from "./dates";

// What a client sees beyond the always-on features follows their data, not a label (00-overview.md "Tracking modes").
// The loader passes what exists: a sport on the profile, any training session, the date of their latest competition.
export type ClientData = { hasSport: boolean; hasSession: boolean; lastCompetitionDate: string | null };

export function clientFeatures({ hasSport, hasSession, lastCompetitionDate }: ClientData, today: string) {
  return {
    training: hasSport || hasSession,
    // An upcoming competition, or one in the last 7 days.
    competition: lastCompetitionDate !== null && lastCompetitionDate >= addDays(today, -7),
  };
}
