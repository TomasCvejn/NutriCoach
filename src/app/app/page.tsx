import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import type { Followed } from "@/lib/enums";
import { FALLBACK_SLOTS, loadDay } from "./nutrition/day-data";
import { buttonVariants } from "@/components/ui/button";
import { currentCheckIn } from "@/lib/check-ins";
import { HydrationCard } from "./hydration/hydration-card";
import { DayProgress } from "./nutrition/day-progress";


// Client home "Today": widgets in the order of home-and-basics.md, each landing with its feature.
export default async function ClientHome() {
  const { user, client } = await requireClient();
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const today = todayIn(user.timezone);
  const period = await currentCheckIn(client, user.timezone);
  const day = await loadDay(
    client.id,
    today,
    FALLBACK_SLOTS.map((s) => t(`DailyNutrition.slots.${s}`)),
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* Widget 1: the date and the day type, which decides the day's targets. */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("ClientHome.title")}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {/* A calendar day: formatted at UTC midnight so no timezone can move it. */}
          <span className="first-letter:uppercase">{format.dateTime(new Date(today), { dateStyle: "full", timeZone: "UTC" })}</span>
          <span className="rounded-full bg-primary-track/60 px-2.5 py-0.5 text-xs font-medium text-primary-ink">{t(`DayTypes.${day.type}`)}</span>
        </p>
      </header>

      {/* Widget 2: today's goals in the client's mode; GUIDANCE lists today's planned meals with their followed status. */}
      <section aria-labelledby="home-nutrition" className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="home-nutrition" className="text-base font-semibold">
            {t("ClientHome.nutrition")}
          </h2>
          <Link href="/app/nutrition" className="text-sm font-medium text-primary-ink hover:underline">
            {t("ClientHome.log")}
          </Link>
        </div>
        <DayProgress day={day} />
        {day.mode === "GUIDANCE" && (
          <ul aria-label={t("ClientHome.meals")} className="mt-4">
            {day.slots.map((slot) => {
              const followed = day.marks.find((m) => m.slot === slot)?.followed as Followed | null | undefined;
              return (
                <li key={slot} className="flex justify-between gap-3 border-t border-rule py-2 text-sm">
                  <span>{slot}</span>
                  <span className={followed ? "" : "text-muted-foreground"}>{followed ? t(`Guidance.options.${followed}`) : t("Guidance.unmarked")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Widget 4: today's fluid with the quick adds (widget 3, training, lands with its feature). */}
      <HydrationCard clientId={client.id} date={today} target={day.target?.fluidMl ?? null} variant="home" />

      {/* Widget 6: the check-in reminder while the period is open. */}
      {(period.status === "due" || period.status === "overdue") && (
        <section aria-labelledby="home-check-in" className={`rounded-lg border p-5 ${period.status === "overdue" ? "border-warning-edge bg-warning-soft" : "bg-card"}`}>
          <h2 id="home-check-in" className="text-base font-semibold">
            {t("ClientHome.checkIn")}
          </h2>
          <p className="mt-1 text-sm">{t(period.status === "overdue" ? "ClientHome.checkInOverdue" : "ClientHome.checkInDue")}</p>
          <Link href="/app/check-in" className={buttonVariants({ className: "mt-3 h-10 px-4" })}>
            {t("ClientHome.checkInOpen")}
          </Link>
        </section>
      )}
    </div>
  );
}
