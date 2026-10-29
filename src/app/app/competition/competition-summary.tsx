import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Competition } from "@/generated/prisma/client";
import { competitionPhase } from "@/lib/competition";
import { diffDays } from "@/lib/dates";
import { TIMELINE_PHASES } from "@/lib/enums";
import { timelineOf } from "@/lib/timeline";
import { TickItem } from "./tick-item";

// The next competition at a glance (competition.md "Competition dashboard"; also client home widget 5): the countdown, the
// current phase with its nutrition priorities, the open tasks of the current and the next phase, a link to the timeline.
// ponytail: race day says "today"; hours to the start come with the race-day schedule (its first event).
export async function CompetitionSummary({ competition, today }: { competition: Competition; today: string }) {
  const t = await getTranslations("Competition");
  const days = diffDays(today, competition.date);
  const phase = competitionPhase(today, competition.date);
  const timeline = timelineOf(competition.timeline);
  const current = phase && phase !== "BASE" ? phase : null;
  // The phase the client is in and the one after it (from base training: the first one).
  const index = current ? TIMELINE_PHASES.indexOf(current) : -1;
  const shown = TIMELINE_PHASES.slice(Math.max(index, 0), index + 2);
  const open = shown.flatMap((p) => (timeline.phases[p]?.tasks ?? []).filter((task) => !task.done).map((task) => ({ phase: p, task })));

  return (
    <section aria-labelledby={`summary-${competition.id}`} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`summary-${competition.id}`} className="text-base font-semibold">
            {competition.name}
          </h2>
          {phase && <p className="mt-1 text-sm text-muted-foreground">{t(`phases.${phase}`)}</p>}
        </div>
        <p className="text-2xl font-bold tabular-nums">{t("countdown", { days })}</p>
      </div>
      {current && timeline.phases[current]?.priorities && <p className="text-sm whitespace-pre-line">{timeline.phases[current]!.priorities}</p>}
      {open.length > 0 && (
        <div>
          <h3 className="text-sm text-muted-foreground">{t("openTasks")}</h3>
          <ul className="border-t border-rule">
            {open.map(({ phase: p, task }) => (
              <li key={task.id} className="flex items-center justify-between gap-3">
                <TickItem competitionId={competition.id} item={task} />
                {p !== current && <span className="flex-none text-xs text-muted-foreground">{t(`phases.${p}`)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/app/competition/${competition.id}`} className="self-start text-sm font-medium text-primary-ink hover:underline">
        {t("openTimeline")}
      </Link>
    </section>
  );
}
