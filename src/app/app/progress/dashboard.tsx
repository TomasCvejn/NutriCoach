import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { type ChartPoint, ChartCard } from "@/components/chart-card";
import { nutritionDays } from "@/lib/adherence";
import type { CheckInAnswers } from "@/lib/check-ins";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES } from "@/lib/enums";
import { daysUntilToday, weeklyNutrition, weeklyTraining, weekStarts } from "@/lib/progress";

export const RANGES = [4, 12, 26] as const;
export const rangeParam = z.object({ range: z.coerce.number().pipe(z.literal(RANGES)).catch(4) });

type Client = { id: string; trackingMode: string };

// The trends on the client's Progress page and the coach's Progress tab, over the last 4 / 12 / 26 weeks (the range lives
// in the URL): weekly nutrition adherence (CALORIES also the average kcal and protein against the target), for a client who
// trains their weekly training minutes, RPE and "felt", and the check-in scores. Body composition follows it on both pages.
export async function ProgressDashboard({ client, timezone, weeks, base, training }: { client: Client; timezone: string; weeks: number; base: string; training: boolean }) {
  const today = todayIn(timezone);
  const starts = weekStarts(today, weeks);
  const [t, format, days, checkIns, sessions, competitions] = await Promise.all([
    getTranslations(),
    getFormatter(),
    nutritionDays([{ ...client, timezone }], new Map([[client.id, daysUntilToday(starts[0], today)]])),
    db.checkIn.findMany({ where: { clientId: client.id, dueDate: { gte: starts[0] } }, orderBy: { dueDate: "asc" }, select: { dueDate: true, answers: true } }),
    // The sessions done so far (today's may still be ahead).
    training ? db.trainingSession.findMany({ where: { clientId: client.id, date: { gte: starts[0], lt: today } }, select: { date: true, durationMin: true, rpe: true, felt: true } }) : [],
    training ? db.competition.findMany({ where: { clientId: client.id, date: { gte: starts[0], lt: today } }, orderBy: { date: "desc" } }) : [],
  ]);
  const performance = weeklyTraining(sessions, starts);
  const weekly = weeklyNutrition(days.get(client.id)!, starts);
  const label = (date: string) => format.dateTime(new Date(date), { day: "numeric", month: "numeric", timeZone: "UTC" });
  const n = (value: number) => format.number(value);
  const percent = (value: number | null) => (value == null ? t("Charts.noData") : format.number(value / 100, { style: "percent" }));
  const versus = (value: number | null, target: number | null, unit: string) =>
    value == null ? t("Charts.noData") : target == null ? `${n(value)} ${unit}` : t("Progress.versus", { value: n(value), target: n(target), unit });
  const adherence: ChartPoint[] = weekly.map((w) => ({ label: label(w.start), value: w.adherence, display: percent(w.adherence) }));
  const kcal: ChartPoint[] = weekly.map((w) => ({ label: label(w.start), value: w.kcal, target: w.kcalTarget, display: versus(w.kcal, w.kcalTarget, "kcal") }));
  const protein: ChartPoint[] = weekly.map((w) => ({ label: label(w.start), value: w.protein, target: w.proteinTarget, display: versus(w.protein, w.proteinTarget, "g") }));
  const legend = { value: t("Progress.average"), target: t("Progress.target") };

  return (
    <>
      <nav aria-label={t("Progress.range")} className="flex gap-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`${base}?range=${r}`}
            aria-current={r === weeks ? "page" : undefined}
            className="flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink sm:h-8"
          >
            {t("Progress.weeks", { count: r })}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="progress-nutrition" className="flex flex-col gap-4">
        <h2 id="progress-nutrition" className="text-lg font-semibold">
          {t("Progress.nutrition")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title={t("Progress.adherence")} points={adherence} domain={[0, 100]} />
          {client.trackingMode === "CALORIES" && (
            <>
              <ChartCard title={t("Progress.kcal")} points={kcal} legend={legend} />
              <ChartCard title={t("Progress.protein")} points={protein} legend={legend} />
            </>
          )}
        </div>
      </section>

      {training && (
        <section aria-labelledby="progress-performance" className="flex flex-col gap-4">
          <h2 id="progress-performance" className="text-lg font-semibold">
            {t("Progress.performance")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title={t("Progress.minutes")} points={performance.map((w) => ({ label: label(w.start), value: w.minutes, display: t("Training.minutes", { count: w.minutes }) }))} />
            {(["rpe", "felt"] as const).map((key) => (
              <ChartCard
                key={key}
                title={t(`Progress.${key}`)}
                domain={[1, 10]}
                points={performance.map((w) => ({ label: label(w.start), value: w[key], display: w[key] == null ? t("Charts.noData") : t("CheckIn.outOf", { score: format.number(w[key]) }) }))}
              />
            ))}
          </div>
          {competitions.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold">{t("Progress.competitions")}</h3>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">{t("Progress.competitions")}</caption>
                <tbody>
                  {competitions.map((c) => (
                    <tr key={c.id} className="border-t border-rule first:border-0">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-muted-foreground tabular-nums">
                        {label(c.date)}
                      </th>
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {[c.result, c.felt != null && t("Competition.felt", { felt: c.felt })].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="progress-check-ins" className="flex flex-col gap-4">
        <h2 id="progress-check-ins" className="text-lg font-semibold">
          {t("Progress.checkIns")}
        </h2>
        {checkIns.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Progress.noCheckIns")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {CHECK_IN_SCALES.map((scale) => (
              <ChartCard
                key={scale}
                title={t(`CheckIn.scales.${scale}.title`)}
                domain={[1, 10]}
                points={checkIns.map((c) => {
                  const score = (c.answers as CheckInAnswers)[scale].score;
                  return { label: label(c.dueDate), value: score, display: t("CheckIn.outOf", { score }) };
                })}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
