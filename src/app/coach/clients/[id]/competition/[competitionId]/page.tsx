import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionDialog } from "@/app/app/competition/competition-dialogs";
import { Button } from "@/components/ui/button";
import { requireCoachOf } from "@/lib/auth";
import { competitionPhase } from "@/lib/competition";
import { diffDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { timelineOf } from "@/lib/timeline";
import { ScheduleBuilder } from "./schedule-builder";
import { TimelineEditor } from "./timeline-editor";

// The coach's plan for one competition (competition.md): its details, its timeline and the race-day schedule.
export default async function CompetitionPlan({ params }: PageProps<"/coach/clients/[id]/competition/[competitionId]">) {
  const { id, competitionId } = await params;
  const { coach, client } = await requireCoachOf(id);
  const competition = await db.competition.findFirst({ where: { id: competitionId, clientId: client.id }, include: { schedule: true } });
  if (!competition) notFound();
  const [t, format, user, templates, recipes, supplements] = await Promise.all([
    getTranslations("Competition"),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } }),
    db.timelineTemplate.findMany({ where: { coachId: coach.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Schedule items can link one of the coach's published recipes (the ones the client can open).
    db.recipe.findMany({ where: { coachId: coach.id, status: "PUBLISHED" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplement.findMany({ where: { clientId: client.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const today = todayIn(user.timezone);
  const days = diffDays(today, competition.date);
  const phase = competitionPhase(today, competition.date);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/coach/clients/${client.id}/competition`} className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" aria-hidden />
            {t("title")}
          </Link>
          <h2 className="text-xl font-bold tracking-tight">{competition.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
            {[
              format.dateTime(new Date(competition.date), { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
              competition.location,
              days >= 0 && t("countdown", { days }).toLowerCase(),
              phase && t(`phases.${phase}`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <CompetitionDialog clientId={client.id} competition={competition} trigger={<Button variant="outline" className="h-10 px-4 sm:h-8 sm:px-3">{t("editDetails")}</Button>} />
      </header>
      <section aria-labelledby="timeline" className="flex flex-col gap-4">
        <h3 id="timeline" className="text-lg font-semibold">
          {t("timeline")}
        </h3>
        <TimelineEditor competitionId={competition.id} timeline={timelineOf(competition.timeline)} templates={templates} />
      </section>
      <ScheduleBuilder competitionId={competition.id} items={competition.schedule} recipes={recipes} supplements={supplements} />
    </div>
  );
}
