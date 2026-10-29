import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tickScheduleItem } from "@/app/app/competition/schedule-actions";
import { Pill } from "@/components/pill";
import { requireClient } from "@/lib/auth";
import { nowIn, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { ScheduleType } from "@/lib/enums";
import { AMOUNTS, betweenEvents, ordered, totals } from "@/lib/schedule";
import { TickItem } from "../../tick-item";

// The race-day schedule for the client (competition.md): a vertical timeline of the day's items to tick off, with a "now"
// marker on race day in the client's timezone, what to take between starts and the day's totals.
export default async function RaceDaySchedule({
  params,
}: PageProps<"/app/competition/[id]/schedule">) {
  const { user, client } = await requireClient();
  const competition = await db.competition.findFirst({
    where: { id: (await params).id, clientId: client.id },
    include: { schedule: true },
  });
  if (!competition) notFound();
  const [t, format, recipes] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.recipe.findMany({
      where: {
        id: {
          in: competition.schedule.flatMap((i) =>
            i.recipeId ? [i.recipeId] : [],
          ),
        },
        coachId: client.coachId,
        status: "PUBLISHED",
      },
      select: { id: true, name: true },
    }),
  ]);
  const list = ordered(competition.schedule);
  const between = new Map(betweenEvents(list).map((b) => [b.after, b.totals]));
  const raceDay = todayIn(user.timezone) === competition.date;
  const now = nowIn(user.timezone);
  // The marker goes before the first item still ahead (after the last one when all are past).
  const marker = raceDay ? list.findIndex((i) => i.time > now) : -2;
  const amounts = (
    values: Partial<Record<(typeof AMOUNTS)[number], number | null>>,
  ) =>
    AMOUNTS.flatMap((key) =>
      values[key]
        ? [t(`Schedule.amounts.${key}`, { value: format.number(values[key]) })]
        : [],
    ).join(" · ");
  const nowRow = (
    <li
      key="now"
      aria-label={t("Schedule.nowAt", { time: now })}
      className="relative -ml-px flex items-center gap-3 py-2 pl-5"
    >
      <span
        aria-hidden
        className="absolute -left-1.5 size-3 rounded-full bg-primary"
      />
      <span className="text-sm font-semibold text-primary-ink tabular-nums">
        {t("Schedule.now", { time: now })}
      </span>
      <span aria-hidden className="h-px flex-1 bg-primary" />
    </li>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <Link
          href={`/app/competition/${competition.id}`}
          className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("Schedule.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
          {format.dateTime(new Date(competition.date), {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </p>
      </header>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {t("Schedule.emptyClient")}
        </p>
      ) : (
        <>
          <ol
            aria-label={t("Schedule.items")}
            className="ml-2 border-l-2 border-rule"
          >
            {list.flatMap((item, i) => [
              ...(i === marker ? [nowRow] : []),
              <li key={item.id} className="relative pl-5">
                <span
                  aria-hidden
                  className={`absolute top-4 -left-[7px] size-3 rounded-full border-2 border-card ${item.type === "EVENT" ? "bg-primary" : "bg-muted-foreground"}`}
                />
                <TickItem
                  competitionId={competition.id}
                  item={item}
                  action={tickScheduleItem}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {item.time}
                      </span>
                      <span className="font-medium">{item.title}</span>
                      <Pill tone={item.type === "EVENT" ? "accent" : "neutral"}>
                        {t(`Schedule.types.${item.type as ScheduleType}`)}
                      </Pill>
                    </span>
                    {(item.details || amounts(item)) && (
                      <span className="text-muted-foreground tabular-nums">
                        {[item.details, amounts(item)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                </TickItem>
                {item.recipeId &&
                  recipes.some((r) => r.id === item.recipeId) && (
                    <Link
                      href={`/app/recipes/${item.recipeId}`}
                      className="-mt-1 mb-2 ml-8 inline-block text-sm font-medium text-primary-ink hover:underline"
                    >
                      {t("Schedule.recipe", {
                        name: recipes.find((r) => r.id === item.recipeId)!.name,
                      })}
                    </Link>
                  )}
                {between.has(i) && (
                  <p className="mb-2 ml-8 rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
                    {t("Schedule.between", {
                      amounts:
                        amounts(between.get(i)!) || t("Schedule.nothing"),
                    })}
                  </p>
                )}
              </li>,
            ])}
            {marker === -1 && nowRow}
          </ol>
          <p className="text-sm tabular-nums">
            <span className="font-medium">{t("Schedule.dayTotal")}</span>{" "}
            {amounts(totals(list)) || t("Schedule.nothing")}
          </p>
        </>
      )}
    </div>
  );
}
