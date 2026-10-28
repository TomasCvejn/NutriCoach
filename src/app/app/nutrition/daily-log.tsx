import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { addDays, diffDays } from "@/lib/dates";
import type { Followed } from "@/lib/enums";
import { totals } from "@/lib/food-log";
import { TARGET_FIELDS } from "@/lib/nutrition";
import { AddFoodDialog, CopyDialog, EditEntryDialog } from "./calories";
import { DayNoteForm, DayTypeSelect } from "./day-controls";
import { loadDay } from "./day-data";
import { DayProgress } from "./day-progress";
import { GuidanceMeal } from "./guidance";
import { PortionGuide } from "./portion-guide";
import { PortionCounters } from "./portions";

const FALLBACK_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"] as const;
const PORTION_KINDS = TARGET_FIELDS.PORTIONS;

// One day of a client's nutrition, the same for the client (/app/nutrition) and their coach (the Nutrition tab's daily
// log, read-only except the day type). The caller has authorized the viewer for this client; this only reads its rows.
export async function DailyLog({ clientId, date, viewer, href }: { clientId: string; date: string; viewer: "CLIENT" | "COACH"; href: (date: string) => string }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const data = await loadDay(
    clientId,
    date,
    FALLBACK_SLOTS.map((s) => t(`DailyNutrition.slots.${s}`)),
  );
  const { mode, today, override, derived, type, dayMeals, logged, portions, marks, slots } = data;
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const amount = (e: (typeof logged)[number]) =>
    e.servingCount != null
      ? t("Calories.servingAmount", { count: n(e.servingCount), serving: e.servingLabel ?? "", grams: n(e.grams ?? 0) })
      : e.grams != null
        ? t("Calories.gramsAmount", { grams: n(e.grams) })
        : null;
  const portionCounts = (row?: (typeof portions)[number]) => Object.fromEntries(PORTION_KINDS.map((k) => [k, row?.[k] ?? 0])) as Record<(typeof PORTION_KINDS)[number], number>;
  const portionText = (row?: (typeof portions)[number]) =>
    row && PORTION_KINDS.flatMap((k) => (row[k] ? [t(`Targets.summary.${k}`, { value: n(row[k]) })] : [])).join(" · ");
  const mark = (slot: string) => marks.find((m) => m.slot === slot);
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
          <DayProgress day={data} />
        </section>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {viewer === "CLIENT" && mode === "CALORIES" && <CopyDialog date={date} />}
          {mode === "PORTIONS" && <PortionGuide />}
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
                {mode === "GUIDANCE" ? (
                  <>
                    {dayMeals.find((m) => m.name === slot)?.guidance && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{dayMeals.find((m) => m.name === slot)!.guidance}</p>}
                    {viewer === "CLIENT" ? (
                      <GuidanceMeal key={`${date}:${slot}`} date={date} slot={slot} followed={(mark(slot)?.followed ?? null) as Followed | null} note={mark(slot)?.note ?? null} />
                    ) : (
                      <p className="mt-2 text-sm">
                        {mark(slot)?.followed ? t(`Guidance.options.${mark(slot)!.followed as Followed}`) : <span className="text-muted-foreground">{t("Guidance.unmarked")}</span>}
                        {mark(slot)?.note && <span className="block whitespace-pre-line text-muted-foreground">{mark(slot)!.note}</span>}
                      </p>
                    )}
                  </>
                ) : mode === "PORTIONS" ? (
                  viewer === "CLIENT" ? (
                    <PortionCounters
                      key={`${date}:${slot}`}
                      date={date}
                      slot={slot}
                      counts={portionCounts(portions.find((p) => p.slot === slot))}
                      plan={dayMeals.find((m) => m.name === slot) ?? null}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {portionText(portions.find((p) => p.slot === slot)) ?? t("DailyNutrition.nothingLogged")}
                    </p>
                  )
                ) : inSlot.length === 0 ? (
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
            <DayNoteForm key={date} clientId={clientId} date={date} note={data.note} />
          ) : (
            <p className={`mt-2 text-sm whitespace-pre-line ${data.note ? "" : "text-muted-foreground"}`}>{data.note ?? t("DailyNutrition.noNote")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
