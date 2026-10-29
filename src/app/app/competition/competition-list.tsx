import { getFormatter, getTranslations } from "next-intl/server";
import { Pill } from "@/components/pill";
import { Button } from "@/components/ui/button";
import type { Competition } from "@/generated/prisma/client";
import { competitionPhase } from "@/lib/competition";
import { diffDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { CompetitionDialog, ResultDialog } from "./competition-dialogs";

// A client's competitions for the client and the coach (`coach`: adds and edits them): the upcoming ones nearest first
// with the days to go and the phase, then the past ones with their result (either of them records it).
export async function CompetitionList({ clientId, timezone, coach }: { clientId: string; timezone: string; coach: boolean }) {
  const today = todayIn(timezone);
  const [t, format, competitions] = await Promise.all([getTranslations("Competition"), getFormatter(), db.competition.findMany({ where: { clientId }, orderBy: { date: "asc" } })]);
  const upcoming = competitions.filter((c) => c.date >= today);
  const past = competitions.filter((c) => c.date < today).reverse();
  const day = (date: string) => format.dateTime(new Date(date), { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const card = (competition: Competition) => {
    const days = diffDays(today, competition.date);
    const phase = competitionPhase(today, competition.date);
    return (
      <li key={competition.id} className="flex flex-col gap-2 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {competition.name}
              <Pill tone={competition.priority === "A" ? "accent" : "neutral"}>{t("priorityShort", { priority: competition.priority })}</Pill>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{[day(competition.date), competition.sport, competition.location].filter(Boolean).join(" · ")}</p>
          </div>
          {days >= 0 && (
            <p className="text-right">
              <span className="block text-lg font-semibold tabular-nums">{t("countdown", { days })}</span>
              {phase && <span className="text-xs text-muted-foreground">{t(`phases.${phase}`)}</span>}
            </p>
          )}
        </div>
        {competition.notes && <p className="text-sm whitespace-pre-line">{competition.notes}</p>}
        {days < 0 && (
          <p className="text-sm">
            {competition.result || competition.felt != null ? (
              [competition.result && t("result", { result: competition.result }), competition.felt != null && t("felt", { felt: competition.felt })].filter(Boolean).join(" · ")
            ) : (
              <span className="text-muted-foreground">{t("noResult")}</span>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {days < 0 && <ResultDialog competition={competition} trigger={<Button variant="outline" className="h-10 px-3 sm:h-8">{t(competition.result || competition.felt != null ? "editResult" : "addResult")}</Button>} />}
          {coach && <CompetitionDialog clientId={clientId} competition={competition} trigger={<Button variant="ghost" className="h-10 px-3 sm:h-8" aria-label={t("editFor", { name: competition.name })}>{t("edit")}</Button>} />}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {coach && (
        <div>
          <CompetitionDialog clientId={clientId} trigger={<Button className="h-10 px-4 sm:h-8 sm:px-3">{t("add")}</Button>} />
        </div>
      )}
      <section aria-labelledby="competitions-upcoming" className="flex flex-col gap-3">
        <h2 id="competitions-upcoming" className="text-base font-semibold">
          {t("upcoming")}
        </h2>
        {upcoming.length ? <ul className="flex flex-col gap-3">{upcoming.map(card)}</ul> : <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t(coach ? "noneCoach" : "none")}</p>}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="competitions-past" className="flex flex-col gap-3">
          <h2 id="competitions-past" className="text-base font-semibold">
            {t("past")}
          </h2>
          <ul className="flex flex-col gap-3">{past.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
