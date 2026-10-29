import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { NoteDialog } from "@/app/coach/clients/[id]/notes/note-dialog";
import { Pill } from "@/components/pill";
import { Sparkline } from "@/components/sparkline";
import { nutritionSummaries } from "@/lib/adherence";
import { requireCoachOf } from "@/lib/auth";
import type { CheckInAnswers } from "@/lib/check-ins";
import { latestWeighIn } from "@/lib/body-comp";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES, FEEDBACK_FIELDS, type TrackingMode } from "@/lib/enums";
import { latestWeight } from "@/lib/nutrition";
import { FeedbackForm } from "./feedback-form";

// One check-in for the coach: the answers with each scale's trend over the last 8 check-ins, the client's questions, the
// week's context and the coach's notes beside it, and the feedback form (or the published feedback).
export default async function CheckInReview({ params }: PageProps<"/coach/check-ins/[id]">) {
  const found = await db.checkIn.findUnique({ where: { id: (await params).id } });
  const { client } = await requireCoachOf(found?.clientId ?? "");
  const checkIn = found!;
  const [t, format, user, history, notes, weighIn] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { name: true, timezone: true } }),
    db.checkIn.findMany({ where: { clientId: client.id, dueDate: { lte: checkIn.dueDate } }, orderBy: { dueDate: "desc" }, take: 8, select: { dueDate: true, answers: true } }),
    db.coachNote.findMany({ where: { clientId: client.id }, orderBy: [{ pinned: "desc" }, { date: "desc" }, { createdAt: "desc" }], take: 5 }),
    latestWeighIn(client.id, checkIn.dueDate),
  ]);
  const weight = latestWeight(client.weightKg, weighIn);
  const week = (await nutritionSummaries([{ id: client.id, trackingMode: client.trackingMode, timezone: user.timezone, today: checkIn.dueDate }])).get(client.id)!;
  const answers = checkIn.answers as CheckInAnswers;
  const trend = history.reverse().map((c) => ({ date: c.dueDate, answers: c.answers as CheckInAnswers }));
  const day = (date: string, style: "short" | "long" = "long") =>
    format.dateTime(new Date(date), style === "long" ? { day: "numeric", month: "long", timeZone: "UTC" } : { day: "numeric", month: "numeric", timeZone: "UTC" });
  const scale = (key: (typeof CHECK_IN_SCALES)[number]) => t(`CheckIn.scales.${key}.title`);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/coach/check-ins" className="-ml-1 inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("CheckInReview.title")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            <Link href={`/coach/clients/${client.id}`} className="hover:underline">
              {user.name}
            </Link>
          </h1>
          {checkIn.reviewedAt ? <Pill>{t("CheckInReview.reviewed")}</Pill> : <Pill tone="accent">{t("Clients.checkIn.toReview")}</Pill>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("CheckInReview.week", { date: day(checkIn.dueDate) })} ·{" "}
          {t("CheckInReview.sent", { date: format.dateTime(checkIn.createdAt, { weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }) })}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="answers" className="rounded-lg border bg-card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="answers" className="text-base font-semibold">
                {t("CheckInReview.answers")}
              </h2>
              <span className="text-xs text-muted-foreground">{t("CheckInReview.trend", { count: trend.length })}</span>
            </div>
            <ul className="mt-2">
              {CHECK_IN_SCALES.map((key) => (
                <li key={key} className="flex items-center gap-4 border-t border-rule py-3 first:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{scale(key)}</p>
                    {answers[key].comment && <p className="mt-0.5 text-sm text-muted-foreground">{answers[key].comment}</p>}
                  </div>
                  <Sparkline
                    domain={[1, 10]}
                    points={trend.map((c) => ({ value: c.answers[key].score, tip: `${day(c.date, "short")}: ${c.answers[key].score} / 10` }))}
                    label={t("CheckInReview.trendLabel", { scale: scale(key), values: trend.map((c) => c.answers[key].score).join(", ") })}
                  />
                  <p className="w-14 flex-none text-right text-lg font-semibold tabular-nums">
                    {answers[key].score}
                    <span className="text-sm font-normal text-muted-foreground"> / 10</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {checkIn.questions && (
            <section aria-labelledby="questions" className="rounded-lg border bg-card p-5">
              <h2 id="questions" className="text-base font-semibold">
                {t("CheckIn.questions")}
              </h2>
              <p className="mt-2 text-base whitespace-pre-line">{checkIn.questions}</p>
            </section>
          )}

          {checkIn.reviewedAt ? (
            <section aria-labelledby="feedback" className="rounded-lg border bg-card p-5">
              <h2 id="feedback" className="text-base font-semibold">
                {t("CheckInReview.feedback")}
              </h2>
              <dl className="mt-2">
                {FEEDBACK_FIELDS.filter((field) => checkIn[field]).map((field) => (
                  <div key={field} className="border-t border-rule py-3 first:border-0">
                    <dt className="text-sm text-muted-foreground">{t(`CheckInReview.fields.${field}`)}</dt>
                    <dd className="mt-1 text-base whitespace-pre-line">{checkIn[field]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <FeedbackForm checkInId={checkIn.id} />
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="context" className="rounded-lg border bg-card p-5">
            <h2 id="context" className="text-base font-semibold">
              {t("CheckInReview.context")}
            </h2>
            <dl className="mt-2 text-sm">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{t("CheckInReview.mode")}</dt>
                <dd>{t(`TrackingModes.${client.trackingMode as TrackingMode}`)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule py-2">
                <dt className="text-muted-foreground">{t("CheckInReview.adherence")}</dt>
                <dd className="tabular-nums">{week.adherence == null ? "–" : format.number(week.adherence / 100, { style: "percent" })}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule py-2">
                <dt className="text-muted-foreground">{t("CheckInReview.weight")}</dt>
                <dd className="tabular-nums">{weight == null ? "–" : format.number(weight, { style: "unit", unit: "kilogram", maximumFractionDigits: 1 })}</dd>
              </div>
            </dl>
            <Link href={`/coach/clients/${client.id}/nutrition`} className="mt-3 inline-flex h-10 items-center text-sm font-medium text-primary-ink hover:underline sm:h-8">
              {t("CheckInReview.editPlan")}
            </Link>
          </section>

          <section aria-labelledby="notes" className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 id="notes" className="text-base font-semibold">
                {t("CheckInReview.notes")}
              </h2>
              <NoteDialog clientId={client.id} today={todayIn(user.timezone)} />
            </div>
            {notes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("CheckInReview.noNotes")}</p>
            ) : (
              <ul className="mt-2">
                {notes.map((note) => (
                  <li key={note.id} className="border-t border-rule py-3 first:border-0">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {day(note.date)}
                      {note.pinned && <Pill>{t("Notes.pinned")}</Pill>}
                    </p>
                    <p className="mt-1 line-clamp-4 text-sm whitespace-pre-line">{note.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/coach/clients/${client.id}/notes`} className="mt-2 inline-flex h-10 items-center text-sm font-medium text-primary-ink hover:underline sm:h-8">
              {t("CheckInReview.allNotes")}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
