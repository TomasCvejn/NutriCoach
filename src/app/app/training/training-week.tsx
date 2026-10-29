import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { DateTimeFormatOptions } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { Pill } from "@/components/pill";
import { Button, buttonVariants } from "@/components/ui/button";
import type { TrainingSession } from "@/generated/prisma/client";
import { addDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Intensity, SessionType } from "@/lib/enums";
import { weekStarts } from "@/lib/progress";
import { SessionDialog } from "./session-dialog";

export const weekParam = z.object({
  week: z.iso.date().optional().catch(undefined),
});

// The training page (client) and Training tab (coach): one week, Monday first (`week` = any day of it, in the URL), with
// each day's sessions, then the next sessions from today. Both add sessions; a session opens its page (`base`/id).
export async function TrainingWeek({ clientId, timezone, week, base }: { clientId: string; timezone: string; week?: string; base: string }) {
  const today = todayIn(timezone);
  const [monday] = weekStarts(week ?? today, 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const order = [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }] as const;
  const [t, format, sessions, upcoming] = await Promise.all([
    getTranslations("Training"),
    getFormatter(),
    db.trainingSession.findMany({
      where: { clientId, date: { gte: monday, lte: days[6] } },
      orderBy: [...order],
    }),
    db.trainingSession.findMany({
      where: { clientId, date: { gte: today } },
      orderBy: [...order],
      take: 5,
    }),
  ]);
  const day = (date: string, options: DateTimeFormatOptions) => format.dateTime(new Date(date), { ...options, timeZone: "UTC" });
  const current = monday === weekStarts(today, 1)[0];
  const href = (date: string) => `${base}?week=${date}`;

  const row = (session: TrainingSession, withDate = false) => (
    <Link
      key={session.id}
      href={`${base}/${session.id}`}
      className="flex w-full flex-col items-start gap-1 rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold">
          {t(`types.${session.type as SessionType}`)}
          {session.sport && ` · ${session.sport}`}
        </span>
        <Pill tone={session.intensity === "VERY_HIGH" || session.intensity === "HIGH" ? "accent" : "neutral"}>
          {t(`intensities.${session.intensity as Intensity}`)}
        </Pill>
      </span>
      <span className="text-sm font-normal text-muted-foreground tabular-nums">
        {[
          withDate &&
            day(session.date, {
              weekday: "short",
              day: "numeric",
              month: "numeric",
            }),
          session.startTime,
          t("minutes", { count: session.durationMin }),
          session.rpe != null && t("rpe", { rpe: session.rpe }),
          session.felt != null && t("felt", { felt: session.felt }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {session.description && <span className="line-clamp-2 text-sm font-normal">{session.description}</span>}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("weekNav")} className="flex items-center gap-1">
          <Link
            href={href(addDays(monday, -7))}
            aria-label={t("previous")}
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "size-10",
            })}
          >
            <ChevronLeftIcon aria-hidden />
          </Link>
          <h2 className="min-w-40 text-center text-base font-semibold tabular-nums">
            {format.dateTimeRange(new Date(monday), new Date(days[6]), {
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}
          </h2>
          <Link
            href={href(addDays(monday, 7))}
            aria-label={t("next")}
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "size-10",
            })}
          >
            <ChevronRightIcon aria-hidden />
          </Link>
          {!current && (
            <Link href={base} className="ml-1 text-sm font-medium text-primary-ink hover:underline">
              {t("thisWeek")}
            </Link>
          )}
        </nav>
        <SessionDialog clientId={clientId} date={current ? today : monday} trigger={<Button className="h-10 px-4 sm:h-8 sm:px-3">{t("add")}</Button>} />
      </div>

      <ol aria-label={t("week")} className="flex flex-col">
        {days.map((date) => {
          const own = sessions.filter((s) => s.date === date);
          return (
            <li
              key={date}
              aria-current={date === today ? "date" : undefined}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-rule py-3 last:border-0"
            >
              <p className="pt-1 text-sm">
                <span className={`block font-medium first-letter:uppercase ${date === today ? "text-primary-ink" : ""}`}>
                  {day(date, { weekday: "short" })}
                </span>
                <span className="text-muted-foreground tabular-nums">{day(date, { day: "numeric", month: "numeric" })}</span>
              </p>
              {own.length ? (
                <div className="flex flex-col gap-2">{own.map((s) => row(s))}</div>
              ) : (
                <p className="pt-1 text-sm text-muted-foreground">{t("rest")}</p>
              )}
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="training-upcoming" className="flex flex-col gap-3">
        <h2 id="training-upcoming" className="text-base font-semibold">
          {t("upcoming")}
        </h2>
        {upcoming.length ? (
          <div className="flex flex-col gap-2">{upcoming.map((s) => row(s, true))}</div>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("noUpcoming")}</p>
        )}
      </section>
    </div>
  );
}
