import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/pill";
import { requireClient } from "@/lib/auth";
import { competitionPhase, PHASE_STARTS } from "@/lib/competition";
import { addDays, diffDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { PACKING_GROUPS, TIMELINE_PHASES } from "@/lib/enums";
import { timelineOf } from "@/lib/timeline";
import { TickItem } from "../tick-item";

// One competition for the client: its timeline phase by phase (the current one marked) with the nutrition priorities and
// the tasks to tick off, and the race-day packing list.
export default async function ClientCompetitionDetail({ params }: PageProps<"/app/competition/[id]">) {
  const { user, client } = await requireClient();
  const competition = await db.competition.findFirst({ where: { id: (await params).id, clientId: client.id }, include: { _count: { select: { schedule: true } } } });
  if (!competition) notFound();
  const [t, format] = await Promise.all([getTranslations("Competition"), getFormatter()]);
  const today = todayIn(user.timezone);
  const current = competitionPhase(today, competition.date);
  const timeline = timelineOf(competition.timeline);
  const days = diffDays(today, competition.date);
  const day = (date: string) => format.dateTime(new Date(date), { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <Link href="/app/competition" className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("title")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{competition.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
          {[day(competition.date), competition.location, days >= 0 && t("countdown", { days }).toLowerCase()].filter(Boolean).join(" · ")}
        </p>
        {competition._count.schedule > 0 && (
          <Link href={`/app/competition/${competition.id}/schedule`} className="mt-2 inline-flex h-10 items-center text-sm font-medium text-primary-ink hover:underline">
            {t("openSchedule")}
          </Link>
        )}
      </header>

      {TIMELINE_PHASES.filter((phase) => timeline.phases[phase]).map((phase) => {
        const { priorities, tasks } = timeline.phases[phase]!;
        return (
          <section key={phase} aria-labelledby={`phase-${phase}`} className={`rounded-lg border bg-card p-5 ${phase === current ? "border-primary" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={`phase-${phase}`} className="text-base font-semibold">
                {t(`phases.${phase}`)}
              </h2>
              {phase === current && <Pill tone="accent">{t("now")}</Pill>}
              <span className="text-sm text-muted-foreground">{t("from", { date: day(addDays(competition.date, -PHASE_STARTS[phase])) })}</span>
            </div>
            {priorities && <p className="mt-2 text-sm whitespace-pre-line">{priorities}</p>}
            {tasks.length > 0 && (
              <ul aria-label={t("tasksOf", { phase: t(`phases.${phase}`) })} className="mt-2 border-t border-rule">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <TickItem competitionId={competition.id} item={task} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {timeline.packing.length > 0 && (
        <section aria-labelledby="packing" className="rounded-lg border bg-card p-5">
          <h2 id="packing" className="text-base font-semibold">
            {t("packing")}
          </h2>
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {PACKING_GROUPS.filter((group) => timeline.packing.some((p) => p.group === group)).map((group) => (
              <div key={group} className="py-2">
                <h3 className="text-sm text-muted-foreground">{t(`packingGroups.${group}`)}</h3>
                <ul aria-label={t(`packingGroups.${group}`)}>
                  {timeline.packing
                    .filter((p) => p.group === group)
                    .map((item) => (
                      <li key={item.id}>
                        <TickItem competitionId={competition.id} item={item} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {Object.keys(timeline.phases).length === 0 && timeline.packing.length === 0 && <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("noTimeline")}</p>}
    </div>
  );
}
