import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { DayType, TrackingMode } from "@/lib/enums";
import { dayType, mealSlots, targetFor } from "@/lib/nutrition";

// Everything one day of a client's nutrition shows, for the day screen and the home widget. The caller has authorized
// the viewer for this client. `fallbackSlots` are the default meal names in the viewer's language.
export async function loadDay(clientId: string, date: string, fallbackSlots: string[]) {
  const [client, day, targets, planMeals, entries, portionLogs, guidanceLogs] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { trackingMode: true, user: { select: { timezone: true } } } }),
    db.nutritionDay.findUnique({ where: { clientId_date: { clientId, date } } }),
    db.nutritionTarget.findMany({ where: { clientId } }),
    db.planMeal.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { dayType: true, name: true, guidance: true, palms: true, hands: true, fists: true, thumbs: true } }),
    db.foodEntry.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.portionLog.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.guidanceLog.findMany({ where: { clientId, date } }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const override = (day?.dayTypeOverride ?? null) as DayType | null;
  const type = dayType({ override });
  // Each mode shows its own log; another mode's logs stay stored and show again when the mode comes back.
  const logged = mode === "CALORIES" ? entries : [];
  const portions = mode === "PORTIONS" ? portionLogs : [];
  const marks = mode === "GUIDANCE" ? guidanceLogs : [];
  const dayMeals = planMeals.filter((m) => m.dayType === type);
  return {
    mode,
    today: todayIn(client.user.timezone),
    note: day?.note ?? null,
    override,
    // ponytail: no sessions or competitions exist yet; their items pass them to dayType here.
    derived: dayType({}),
    type,
    target: targetFor(targets, date, type),
    dayMeals,
    logged,
    portions,
    marks,
    slots: mealSlots(
      dayMeals.map((m) => m.name),
      [...logged, ...portions, ...marks].map((e) => e.slot),
      fallbackSlots,
    ),
  };
}

export type Day = Awaited<ReturnType<typeof loadDay>>;
