import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { DayType, TrackingMode } from "@/lib/enums";
import { dailyFluidTarget, duringTotals, fuelingFor } from "@/lib/fueling";
import { dayType, mealSlots, targetFor } from "@/lib/nutrition";

// The default meals of a day without plan meals (keys under DailyNutrition.slots).
export const FALLBACK_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"] as const;

// Everything one day of a client's nutrition shows, for the day screen and the home widget. The caller has authorized
// the viewer for this client. `fallbackSlots` are the default meal names in the viewer's language.
export async function loadDay(clientId: string, date: string, fallbackSlots: string[]) {
  const [client, day, targets, planMeals, entries, portionLogs, guidanceLogs, sessions, competition] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { trackingMode: true, coachId: true, user: { select: { timezone: true } } } }),
    db.nutritionDay.findUnique({ where: { clientId_date: { clientId, date } } }),
    db.nutritionTarget.findMany({ where: { clientId } }),
    db.planMeal.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { dayType: true, name: true, guidance: true, palms: true, hands: true, fists: true, thumbs: true, recipeIds: true } }),
    db.foodEntry.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.portionLog.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
    db.guidanceLog.findMany({ where: { clientId, date } }),
    db.trainingSession.findMany({ where: { clientId, date }, orderBy: [{ startTime: "asc" }, { createdAt: "asc" }] }),
    db.competition.findFirst({ where: { clientId, date }, select: { id: true } }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const override = (day?.dayTypeOverride ?? null) as DayType | null;
  const derived = dayType({ competition: Boolean(competition), session: sessions.length > 0 });
  const type = override ?? derived;
  // Each mode shows its own log; another mode's logs stay stored and show again when the mode comes back.
  const logged = mode === "CALORIES" ? entries : [];
  const portions = mode === "PORTIONS" ? portionLogs : [];
  const marks = mode === "GUIDANCE" ? guidanceLogs : [];
  const dayMeals = planMeals.filter((m) => m.dayType === type);
  const [recipes, templates] = await Promise.all([
    // The meals' recipe options the client can open: their coach's published recipes.
    db.recipe.findMany({ where: { id: { in: dayMeals.flatMap((m) => m.recipeIds as string[]) }, coachId: client.coachId, status: "PUBLISHED" }, select: { id: true, name: true } }),
    sessions.length ? db.fuelingTemplate.findMany({ where: { coachId: client.coachId } }) : [],
  ]);
  // The day's sessions, each with its fueling plan and what "during" adds up to.
  const fueled = sessions.map((session) => {
    const plan = fuelingFor(session, templates, session.fuelingTemplateId);
    return { session, plan, totals: plan && duringTotals(plan, session.durationMin) };
  });
  const target = targetFor(targets, date, type);
  return {
    coachId: client.coachId,
    recipes,
    mode,
    today: todayIn(client.user.timezone),
    note: day?.note ?? null,
    override,
    derived,
    type,
    target,
    sessions: fueled,
    fluidTarget: dailyFluidTarget(target?.fluidMl ?? null, type, fueled.map((f) => f.totals?.fluidMl ?? null)),
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
