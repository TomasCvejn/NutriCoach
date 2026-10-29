import { addDays } from "./dates";
import { db } from "./db";

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

// The features of a client from their data: a sport on the profile, any session.
// ponytail: no competitions exist yet; their item feeds the latest date in here.
export async function featuresOf(client: { id: string; sports: string | null }, today: string) {
  const session = await db.trainingSession.findFirst({ where: { clientId: client.id }, select: { id: true } });
  return clientFeatures({ hasSport: Boolean(client.sports), hasSession: Boolean(session), lastCompetitionDate: null }, today);
}
