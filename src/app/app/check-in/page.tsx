import { getFormatter, getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { addDays, weekday } from "@/lib/dates";
import { CHECK_IN_SCALES, type CheckInScale } from "@/lib/enums";
import { CheckInForm } from "./check-in-form";
import { currentCheckIn } from "@/lib/check-ins";

type Answers = Record<CheckInScale, { score: number; comment: string | null }>;

// The weekly check-in (More → Check-in): the form while the period is open, else what was sent and when the next one is.
export default async function ClientCheckIn() {
  const { user, client } = await requireClient();
  const [t, format, period] = await Promise.all([getTranslations("CheckIn"), getFormatter(), currentCheckIn(client, user.timezone)]);
  const day = (date: string) => format.dateTime(new Date(date), { dateStyle: "full", timeZone: "UTC" });
  const next = addDays(period.today, (client.checkInWeekday - weekday(period.today) + 7) % 7 || 7);
  const open = period.status === "due" || period.status === "overdue";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
          {open ? t(period.status === "overdue" ? "overdue" : "due", { date: day(period.dueDate!) }) : t("next", { date: day(next) })}
        </p>
      </header>
      {open ? (
        <CheckInForm />
      ) : period.checkIn ? (
        <section aria-labelledby="sent" className="rounded-lg border bg-card p-5">
          <h2 id="sent" className="text-base font-semibold">
            {t(period.status === "toReview" ? "sentWaiting" : "sentReviewed")}
          </h2>
          <dl className="mt-3 text-sm">
            {CHECK_IN_SCALES.map((scale) => {
              const answer = (period.checkIn!.answers as Answers)[scale];
              return (
                <div key={scale} className="flex justify-between gap-4 border-t border-rule py-2">
                  <dt className="text-muted-foreground">{t(`scales.${scale}.title`)}</dt>
                  <dd className="text-right">
                    <span className="tabular-nums">{t("outOf", { score: answer.score })}</span>
                    {answer.comment && <span className="block text-xs text-muted-foreground">{answer.comment}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {period.checkIn.questions && <p className="mt-3 text-sm whitespace-pre-line">{period.checkIn.questions}</p>}
        </section>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("notYet")}</p>
      )}
    </div>
  );
}
