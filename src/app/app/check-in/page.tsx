import { ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { requireClient } from "@/lib/auth";
import { addDays, weekday } from "@/lib/dates";
import { db } from "@/lib/db";
import { CheckInForm } from "./check-in-form";
import { type CheckInAnswers, currentCheckIn } from "@/lib/check-ins";
import { SentAnswers } from "./sent-answers";

// The weekly check-in (More → Check-in): the form while the period is open, else what was sent and when the next one is;
// below, the earlier check-ins, each leading to its feedback.
export default async function ClientCheckIn() {
  const { user, client } = await requireClient();
  const [t, format, period, history] = await Promise.all([
    getTranslations("CheckIn"),
    getFormatter(),
    currentCheckIn(client, user.timezone),
    db.checkIn.findMany({ where: { clientId: client.id }, orderBy: { dueDate: "desc" }, select: { id: true, dueDate: true, reviewedAt: true, feedbackSeenAt: true } }),
  ]);
  const day = (date: string) => format.dateTime(new Date(date), { dateStyle: "full", timeZone: "UTC" });
  const next = addDays(period.today, (client.checkInWeekday - weekday(period.today) + 7) % 7 || 7);
  const open = period.status === "due" || period.status === "overdue";
  const earlier = history.filter((c) => c.id !== period.checkIn?.id);

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
          {period.checkIn.reviewedAt && (
            <Link href={`/app/check-in/${period.checkIn.id}`} className="mt-1 inline-flex h-10 items-center text-sm font-medium text-primary-ink hover:underline">
              {t("readFeedback")}
            </Link>
          )}
          <SentAnswers answers={period.checkIn.answers as CheckInAnswers} questions={period.checkIn.questions} />
        </section>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("notYet")}</p>
      )}

      {earlier.length > 0 && (
        <section aria-labelledby="earlier">
          <h2 id="earlier" className="text-base font-semibold">
            {t("earlier")}
          </h2>
          <ul className="mt-2 rounded-lg border bg-card">
            {earlier.map((checkIn) => (
              <li key={checkIn.id} className="border-b border-rule last:border-0">
                <Link href={`/app/check-in/${checkIn.id}`} className="flex min-h-12 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60">
                  <span className="flex-1 text-sm first-letter:uppercase">{t("weekOf", { date: format.dateTime(new Date(checkIn.dueDate), { day: "numeric", month: "long", timeZone: "UTC" }) })}</span>
                  {!checkIn.reviewedAt ? (
                    <span className="text-sm text-muted-foreground">{t("waiting")}</span>
                  ) : checkIn.feedbackSeenAt ? (
                    <span className="text-sm text-muted-foreground">{t("feedback")}</span>
                  ) : (
                    <Pill tone="accent">{t("newFeedback")}</Pill>
                  )}
                  <ChevronRightIcon aria-hidden className="size-4 flex-none text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
