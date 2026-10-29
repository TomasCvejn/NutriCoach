import { z } from "zod";
import { requireCoach } from "./auth";
import { db } from "./db";
import { type CheckInStatus, TRACKING_MODES } from "./enums";
import { fold } from "./text";
import { checkInStatuses } from "./check-ins";
import { type NutritionSummary, nutritionSummaries } from "./adherence";
import { nextCompetition } from "./competition";
import { diffDays, todayIn } from "./dates";

const CHECK_IN_ORDER: CheckInStatus[] = ["overdue", "due", "toReview", "ok"];

// The coach's client list (/coach/clients): one query for the coach's clients, then search, filters and sorting in memory.
// ponytail: in memory because a coach has tens of clients and later columns (adherence, check-in status) are computed per row anyway.

export const CLIENT_STATUSES = ["ONBOARDING", "ACTIVE", "INACTIVE"] as const; // also the status sort order
export const STATUS_FILTERS = ["active", "inactive", "all"] as const;
export const SORT_COLUMNS = ["name", "mode", "status", "lastLogged", "adherence", "checkIn", "competition", "unread"] as const;

// Search params as the URL gives them; anything unexpected falls back to the default view.
export const listParams = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(STATUS_FILTERS).catch("active"),
  mode: z.enum(TRACKING_MODES).optional().catch(undefined),
  sort: z.enum(SORT_COLUMNS).catch("name"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});
export type ListParams = z.infer<typeof listParams>;

export type ClientRow = { id: string; name: string; email: string; trackingMode: string; status: (typeof CLIENT_STATUSES)[number]; checkIn: CheckInStatus } & {
  nextCompetition: { name: string; days: number } | null;
  unread: number; // messages from the client the coach hasn't read
} & NutritionSummary;

export async function coachClients(): Promise<ClientRow[]> {
  const coach = await requireCoach();
  const clients = await db.client.findMany({
    where: { coachId: coach.id },
    select: { id: true, trackingMode: true, onboardingCompletedAt: true, checkInWeekday: true, user: { select: { name: true, email: true, active: true, timezone: true } } },
  });
  const today = new Map(clients.map((c) => [c.id, todayIn(c.user.timezone)]));
  const [nutrition, checkIns, competitions, unread] = await Promise.all([
    nutritionSummaries(clients.map((c) => ({ id: c.id, trackingMode: c.trackingMode, timezone: c.user.timezone }))),
    checkInStatuses(clients.map((c) => ({ ...c, timezone: c.user.timezone }))),
    // From the earliest "today" of the clients' timezones; each client's own today picks theirs below.
    db.competition.findMany({ where: { clientId: { in: clients.map((c) => c.id) }, date: { gte: [...today.values()].sort()[0] } }, select: { clientId: true, name: true, date: true } }),
    db.message.groupBy({ by: ["clientId"], where: { client: { coachId: coach.id }, senderId: { not: coach.id }, readAt: null }, _count: true }),
  ]);
  return clients.map(({ id, trackingMode, onboardingCompletedAt, user }) => {
    const next = nextCompetition(
      competitions.filter((c) => c.clientId === id),
      today.get(id)!,
    );
    return {
      id,
      trackingMode,
      name: user.name,
      email: user.email,
      status: !user.active ? "INACTIVE" : onboardingCompletedAt ? "ACTIVE" : "ONBOARDING",
      checkIn: checkIns.get(id)!,
      nextCompetition: next && { name: next.name, days: diffDays(today.get(id)!, next.date) },
      unread: unread.find((u) => u.clientId === id)?._count ?? 0,
      ...nutrition.get(id)!,
    };
  });
}

const inStatus = (row: ClientRow, status: ListParams["status"]) => status === "all" || (status === "inactive") === (row.status === "INACTIVE");

// The rows to show, and the count of each status tab under the same search and mode filter.
export function clientList(rows: ClientRow[], p: ListParams, locale: string) {
  const collator = new Intl.Collator(locale);
  const q = fold(p.q);
  const matching = rows.filter((r) => (!p.mode || r.trackingMode === p.mode) && fold(r.name).includes(q));
  const counts = Object.fromEntries(STATUS_FILTERS.map((s) => [s, matching.filter((r) => inStatus(r, s)).length])) as Record<ListParams["status"], number>;
  // Never logged / no adherence sort as the lowest.
  const rank = {
    name: () => 0,
    mode: (r: ClientRow) => TRACKING_MODES.indexOf(r.trackingMode as (typeof TRACKING_MODES)[number]),
    status: (r: ClientRow) => CLIENT_STATUSES.indexOf(r.status),
    lastLogged: (r: ClientRow) => r.lastLogged ?? "",
    adherence: (r: ClientRow) => r.adherence ?? -1,
    checkIn: (r: ClientRow) => CHECK_IN_ORDER.indexOf(r.checkIn), // the most urgent first
    competition: (r: ClientRow) => r.nextCompetition?.days ?? Infinity, // the nearest first, none last
    unread: (r: ClientRow) => -r.unread, // the most first
  }[p.sort];
  const order = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0);
  const sign = p.dir === "asc" ? 1 : -1;
  const shown = matching
    .filter((r) => inStatus(r, p.status))
    .sort((a, b) => sign * (order(rank(a), rank(b)) || collator.compare(a.name, b.name)));
  return { rows: shown, counts };
}
