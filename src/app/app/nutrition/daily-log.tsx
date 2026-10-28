import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { addDays, diffDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { type DayType, MICRONUTRIENTS, type TrackingMode } from "@/lib/enums";
import { dayType, mealSlots, targetFor } from "@/lib/nutrition";
import { targetSummary } from "@/lib/target-summary";
import { TargetBar } from "@/components/target-bar";
import { MACRO_FIELDS, micronutrientTotals, totals } from "@/lib/food-log";
import { AddFoodDialog, CopyDialog, EditEntryDialog } from "./calories";
import { DayNoteForm, DayTypeSelect } from "./day-controls";

const FALLBACK_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"] as const;

// One day of a client's nutrition, the same for the client (/app/nutrition) and their coach (the Nutrition tab's daily
// log, read-only except the day type). The caller has authorized the viewer for this client; this only reads its rows.
export async function DailyLog({ clientId, date, viewer, href }: { clientId: string; date: string; viewer: "CLIENT" | "COACH"; href: (date: string) => string }) {
  const [t, format, client, day, targets, planMeals, entries] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { trackingMode: true, user: { select: { timezone: true } } } }),
    db.nutritionDay.findUnique({ where: { clientId_date: { clientId, date } } }),
    db.nutritionTarget.findMany({ where: { clientId } }),
    db.planMeal.findMany({ where: { clientId }, orderBy: { position: "asc" }, select: { dayType: true, name: true } }),
    db.foodEntry.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const today = todayIn(client.user.timezone);
  const override = (day?.dayTypeOverride ?? null) as DayType | null;
  // ponytail: no sessions or competitions exist yet; their items pass them to dayType here.
  const derived = dayType({});
  const type = dayType({ override });
  const target = targetFor(targets, date, type);
  const summary = target && targetSummary(target, mode, t, (v) => format.number(v, { maximumFractionDigits: 1 }));
  // The food log shows in CALORIES mode; another mode's logs stay stored and show again when the mode comes back.
  const logged = mode === "CALORIES" ? entries : [];
  const slots = mealSlots(
    planMeals.filter((m) => m.dayType === type).map((m) => m.name),
    logged.map((e) => e.slot),
    FALLBACK_SLOTS.map((s) => t(`DailyNutrition.slots.${s}`)),
  );
  const dayTotals = totals(logged);
  const micro = micronutrientTotals(logged);
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const amount = (e: (typeof entries)[number]) =>
    e.servingCount != null
      ? t("Calories.servingAmount", { count: n(e.servingCount), serving: e.servingLabel ?? "", grams: n(e.grams ?? 0) })
      : e.grams != null
        ? t("Calories.gramsAmount", { grams: n(e.grams) })
        : null;
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
          {mode === "CALORIES" ? (
            // The day's totals against its targets; a macro without a target shows its total only.
            <div className="mt-4 flex flex-col gap-3">
              {MACRO_FIELDS.map((f) => {
                const unit = f === "kcal" ? "kcal" : "g";
                const goal = target?.[f];
                return goal ? (
                  <TargetBar
                    key={f}
                    label={t(`Calories.bars.${f}`)}
                    value={dayTotals[f]}
                    target={goal}
                    text={t("Calories.ofTarget", { value: n(dayTotals[f]), target: n(goal), unit })}
                    // Only kcal past the adherence window is a problem; going over a macro is just shown as over.
                    alarm={f === "kcal" && dayTotals.kcal > goal * 1.1 ? t("Calories.over", { value: n(dayTotals.kcal - goal), unit }) : undefined}
                  />
                ) : (
                  <p key={f} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t(`Calories.bars.${f}`)}</span>
                    <span className="tabular-nums">{t("Calories.total", { value: n(dayTotals[f]), unit })}</span>
                  </p>
                );
              })}
              {!target && <p className="text-xs text-muted-foreground">{t("DailyNutrition.targets")}: {t("DailyNutrition.noTargets")}</p>}
            {/* Fiber and sodium, the only micronutrients tracked: against their targets when set; "incomplete" when some entries lack them. */}
            {(Object.keys(MICRONUTRIENTS) as (keyof typeof MICRONUTRIENTS)[]).map((f) => {
              const goal = target?.[f];
              const unit = MICRONUTRIENTS[f];
              const total = micro[f].total;
              return goal ? (
                <TargetBar key={f} label={t(`Calories.bars.${f}`)} value={total} target={goal} text={t("Calories.ofTarget", { value: n(total), target: n(goal), unit })} />
              ) : (
                <p key={f} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t(`Calories.bars.${f}`)}</span>
                  <span className="tabular-nums">{t("Calories.total", { value: n(total), unit })}</span>
                </p>
              );
            })}
            {Object.values(micro).some((m) => m.missing > 0) && <p className="text-xs text-muted-foreground">{t("Calories.incomplete")}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm tabular-nums">
              <span className="text-muted-foreground">{t("DailyNutrition.targets")}: </span>
              {summary ?? <span className="text-muted-foreground">{t("DailyNutrition.noTargets")}</span>}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {viewer === "CLIENT" && mode === "CALORIES" && <CopyDialog date={date} />}
          {slots.map((slot, i) => {
            const inSlot = logged.filter((e) => e.slot === slot);
            return (
              <section key={slot} aria-labelledby={`slot-${i}`} className="rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id={`slot-${i}`} className="text-base font-semibold">
                    {slot}
                  </h2>
                  <div className="flex items-center gap-3">
                    {inSlot.length > 0 && <span className="text-sm text-muted-foreground tabular-nums">{t("Calories.total", { value: n(totals(inSlot).kcal), unit: "kcal" })}</span>}
                    {viewer === "CLIENT" && mode === "CALORIES" && (
                      <span className="-mr-2.5 flex">
                        <CopyDialog date={date} slot={slot} />
                        <AddFoodDialog date={date} slot={slot} slots={slots} />
                      </span>
                    )}
                  </div>
                </div>
                {inSlot.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">{t("DailyNutrition.nothingLogged")}</p>
                ) : (
                  <ul className="mt-2">
                    {inSlot.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 border-t border-rule py-2.5 first:border-t-0">
                        <div className="min-w-0 flex-1 text-sm">
                          <p>
                            <span className="font-medium">{e.name ?? t("Calories.quickAdd")}</span>
                            {amount(e) && <span className="text-muted-foreground"> · {amount(e)}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">{t("Calories.macros", { protein: n(e.protein), carbs: n(e.carbs), fat: n(e.fat) })}</p>
                        </div>
                        <span className="flex-none pt-px text-sm tabular-nums">{t("Calories.total", { value: n(Math.round(e.kcal)), unit: "kcal" })}</span>
                        {viewer === "CLIENT" && <EditEntryDialog entry={e} label={t("Calories.editEntry", { name: e.name ?? t("Calories.quickAdd") })} slots={slots} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
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
