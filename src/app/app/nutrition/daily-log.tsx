import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { addDays, diffDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { DayType, TrackingMode } from "@/lib/enums";
import { dayType, mealSlots, targetFor } from "@/lib/nutrition";
import { targetSummary } from "@/lib/target-summary";
import { Button } from "@/components/ui/button";
import { DayNoteForm, DayTypeSelect } from "./day-controls";
import { FoodDialog } from "./food-dialog";

const FALLBACK_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"] as const;

// One day of a client's nutrition, the same for the client (/app/nutrition) and their coach (the Nutrition tab's daily
// log, read-only except the day type). The caller has authorized the viewer for this client; this only reads its rows.
export async function DailyLog({ clientId, date, viewer, href }: { clientId: string; date: string; viewer: "CLIENT" | "COACH"; href: (date: string) => string }) {
  const [t, format, client, day, targets, planMeals] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { trackingMode: true, user: { select: { timezone: true } } } }),
    db.nutritionDay.findUnique({ where: { clientId_date: { clientId, date } } }),
    db.nutritionTarget.findMany({ where: { clientId } }),
    db.planMeal.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { dayType: true, name: true } }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const today = todayIn(client.user.timezone);
  const override = (day?.dayTypeOverride ?? null) as DayType | null;
  // ponytail: no sessions or competitions exist yet; their items pass them to dayType here.
  const derived = dayType({});
  const type = dayType({ override });
  const target = targetFor(targets, date, type);
  const summary = target && targetSummary(target, mode, t, (v) => format.number(v, { maximumFractionDigits: 1 }));
  // ponytail: no entries exist yet; the logging items add the slots found in the day's entries.
  const slots = mealSlots(
    planMeals.filter((m) => m.dayType === type).map((m) => m.name),
    [],
    FALLBACK_SLOTS.map((s) => t(`DailyNutrition.slots.${s}`)),
  );
  const offset = diffDays(today, date);
  const relative = offset === 0 ? "today" : offset === -1 ? "yesterday" : offset === 1 ? "tomorrow" : null;
  // A calendar day: formatted at UTC midnight so no timezone can move it.
  const full = format.dateTime(new Date(date), { dateStyle: "full", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("DailyNutrition.dateNav")} className="flex items-center gap-2">
        <Link href={href(addDays(date, -1))} aria-label={t("DailyNutrition.previous")} className="flex size-10 flex-none items-center justify-center rounded-lg border bg-card hover:bg-muted">
          <ChevronLeftIcon aria-hidden className="size-4" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-base font-semibold first-letter:uppercase">{relative ? t(`DailyNutrition.${relative}`) : full}</p>
          {relative && <p className="text-xs text-muted-foreground first-letter:uppercase">{full}</p>}
        </div>
        <Link href={href(addDays(date, 1))} aria-label={t("DailyNutrition.next")} className="flex size-10 flex-none items-center justify-center rounded-lg border bg-card hover:bg-muted">
          <ChevronRightIcon aria-hidden className="size-4" />
        </Link>
      </nav>
      {offset !== 0 && (
        <Link href={href(today)} className="-mt-4 self-center text-sm font-medium text-primary-ink hover:underline">
          {t("DailyNutrition.backToToday")}
        </Link>
      )}

      {/* Phone: the day, its meals, the note. Desktop: the meals on the left, the day and the note in a rail on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <section aria-labelledby="day-type" className="rounded-lg border bg-card p-5 lg:col-start-2 lg:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 id="day-type" className="text-base font-semibold">
                <span className="sr-only">{t("DailyNutrition.dayType")}: </span>
                <Pill tone="accent">{t(`DayTypes.${type}`)}</Pill>
              </h2>
              {override && <span className="text-xs text-muted-foreground">{t("DailyNutrition.setByHand")}</span>}
            </div>
            <DayTypeSelect key={date} clientId={clientId} date={date} override={override} derived={derived} />
          </div>
          <p className="mt-3 text-sm tabular-nums">
            <span className="text-muted-foreground">{t("DailyNutrition.targets")}: </span>
            {summary ?? <span className="text-muted-foreground">{t("DailyNutrition.noTargets")}</span>}
          </p>
        </section>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {/* ponytail: on its own until the CALORIES add flow, which offers it when a search finds nothing. */}
          {viewer === "CLIENT" && mode === "CALORIES" && (
            <FoodDialog trigger={<Button variant="outline" className="h-10 self-start px-3 sm:h-8">{t("Foods.create")}</Button>} />
          )}
          {slots.map((slot, i) => (
            <section key={slot} aria-labelledby={`slot-${i}`} className="rounded-lg border bg-card p-5">
              <h2 id={`slot-${i}`} className="text-base font-semibold">
                {slot}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("DailyNutrition.nothingLogged")}</p>
            </section>
          ))}
        </div>

        <section aria-labelledby="day-note" className="rounded-lg border bg-card p-5 lg:col-start-2 lg:row-start-2">
          <h2 id="day-note" className="text-base font-semibold">
            {t(viewer === "CLIENT" ? "DailyNutrition.note" : "DailyNutrition.clientNote")}
          </h2>
          {viewer === "CLIENT" ? (
            <DayNoteForm key={date} clientId={clientId} date={date} note={day?.note ?? null} />
          ) : (
            <p className={`mt-2 text-sm whitespace-pre-line ${day?.note ? "" : "text-muted-foreground"}`}>{day?.note ?? t("DailyNutrition.noNote")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
