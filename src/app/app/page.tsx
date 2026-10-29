import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Followed, Intensity, SessionType } from "@/lib/enums";
import { featuresOf } from "@/lib/features";
import { unreadMessages } from "@/lib/messages";
import { FALLBACK_SLOTS, loadDay } from "./nutrition/day-data";
import { buttonVariants } from "@/components/ui/button";
import { currentCheckIn } from "@/lib/check-ins";
import { CompetitionSummary } from "./competition/competition-summary";
import { HydrationCard } from "./hydration/hydration-card";
import { DayProgress } from "./nutrition/day-progress";


// Client home "Today": widgets in the order of home-and-basics.md, each landing with its feature.
export default async function ClientHome() {
  const { user, client } = await requireClient();
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const today = todayIn(user.timezone);
  const [period, feedback, { training, competition: competes }, competition, messages] = await Promise.all([
    currentCheckIn(client, user.timezone),
    db.checkIn.findFirst({ where: { clientId: client.id, reviewedAt: { not: null }, feedbackSeenAt: null }, orderBy: { dueDate: "desc" }, select: { id: true, dueDate: true } }),
    featuresOf(client, today),
    db.competition.findFirst({ where: { clientId: client.id, date: { gte: today } }, orderBy: { date: "asc" } }),
    unreadMessages(user),
  ]);
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

      {/* Widget 3: today's training with each session's fueling, for a client who trains. */}
      {training && (
        <section aria-labelledby="home-training" className="rounded-lg border bg-card p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="home-training" className="text-base font-semibold">
              {t("ClientHome.training")}
            </h2>
            <Link href="/app/training" className="text-sm font-medium text-primary-ink hover:underline">
              {t("ClientHome.trainingOpen")}
            </Link>
          </div>
          {day.sessions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("ClientHome.trainingNone")}</p>
          ) : (
            <ul className="mt-2">
              {day.sessions.map(({ session, totals }) => (
                <li key={session.id} className="border-t border-rule first:border-0">
                  <Link href={`/app/training/${session.id}`} className="flex flex-col gap-0.5 py-2 text-sm hover:underline">
                    <span className="flex justify-between gap-3">
                      <span className="font-medium">
                        {t(`Training.types.${session.type as SessionType}`)}
                        {session.sport && ` · ${session.sport}`}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {[session.startTime, t("Training.minutes", { count: session.durationMin }), t(`Training.intensities.${session.intensity as Intensity}`)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {totals
                        ? t("ClientHome.fueling", {
                            during: [
                              totals.carbs != null && t("Training.carbs", { value: format.number(totals.carbs) }),
                              totals.fluidMl != null && t("Hydration.ml", { ml: format.number(totals.fluidMl) }),
                              totals.sodiumMg != null && t("Hydration.sodium", { mg: format.number(totals.sodiumMg) }),
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          })
                        : t("Training.noFuelingShort")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Widget 4: today's fluid with the quick adds. */}
      <HydrationCard clientId={client.id} date={today} target={day.fluidTarget} variant="home" />

      {/* Widget 5: the next competition, while one is coming. */}
      {competes && competition && <CompetitionSummary competition={competition} today={today} timezone={user.timezone} />}

      {/* Widget 6: the check-in reminder while the period is open, and the coach's feedback until it is opened. */}
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
      {feedback && (
        <section aria-labelledby="home-feedback" className="rounded-lg border bg-card p-5">
          <h2 id="home-feedback" className="text-base font-semibold">
            {t("ClientHome.feedback")}
          </h2>
          <p className="mt-1 text-sm">{t("ClientHome.feedbackText", { date: format.dateTime(new Date(feedback.dueDate), { day: "numeric", month: "long", timeZone: "UTC" }) })}</p>
          <Link href={`/app/check-in/${feedback.id}`} className={buttonVariants({ variant: "outline", className: "mt-3 h-10 px-4" })}>
            {t("ClientHome.feedbackOpen")}
          </Link>
        </section>
      )}

      {/* Widget 7: new messages from the coach. */}
      {messages > 0 && (
        <section aria-labelledby="home-messages" className="rounded-lg border bg-card p-5">
          <h2 id="home-messages" className="text-base font-semibold">
            {t("ClientHome.messages")}
          </h2>
          <p className="mt-1 text-sm">{t("Messages.unread", { count: messages })}</p>
          <Link href="/app/messages" className={buttonVariants({ variant: "outline", className: "mt-3 h-10 px-4" })}>
            {t("ClientHome.messagesOpen")}
          </Link>
        </section>
      )}
    </div>
  );
}
