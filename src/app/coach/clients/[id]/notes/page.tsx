import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";
import { Pill } from "@/components/pill";
import type { CoachNote, HistoryEvent } from "@/generated/prisma/client";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { HistoryPayloads, HistoryType } from "@/lib/enums";
import { FEED_TYPES, type FeedCheckIn, type FeedCompetition, historyFeed } from "@/lib/history";
import { NoteDialog } from "./note-dialog";

const filter = z.object({ type: z.enum(FEED_TYPES).optional().catch(undefined) });

// Notes tab (coach only): pinned notes first, then one feed of notes and history, newest day first, filtered by type.
export default async function ClientNotes({ params, searchParams }: PageProps<"/coach/clients/[id]/notes">) {
  const { client } = await requireCoachOf((await params).id);
  const { type } = filter.parse(await searchParams);
  const [t, format, user, notes, events, checkIns, competitions] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } }),
    db.coachNote.findMany({ where: { clientId: client.id } }),
    db.historyEvent.findMany({ where: { clientId: client.id } }),
    db.checkIn.findMany({ where: { clientId: client.id }, select: { id: true, dueDate: true, createdAt: true, reviewedAt: true, response: true } }),
    db.competition.findMany({ where: { clientId: client.id }, select: { id: true, name: true, date: true, createdAt: true, result: true, felt: true } }),
  ]);
  const { pinned, feed } = historyFeed({ notes, events, checkIns, competitions }, type);
  const today = todayIn(user.timezone);
  // A calendar day: formatted at UTC midnight so no timezone can move it.
  const day = (date: string) => format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" });
  const base = `/coach/clients/${client.id}/notes`;

  // Columns: the day · the type and the text · edit (notes only, in a fixed slot so the rows line up).
  const row = (key: string, date: string, mark: ReactNode, text: string, edit?: ReactNode) => (
    <li key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-b border-rule py-3 sm:grid-cols-[7rem_minmax(0,1fr)_4.5rem]">
      <time dateTime={date} className="text-sm text-muted-foreground tabular-nums sm:pt-0.5">
        {day(date)}
      </time>
      <div className="col-start-1 flex flex-col items-start gap-1.5 sm:col-start-2 sm:row-start-1">
        {mark}
        <p className="text-sm whitespace-pre-line">{text}</p>
      </div>
      <div className="col-start-2 row-span-2 row-start-1 flex justify-end sm:col-start-3 sm:row-span-1">{edit}</div>
    </li>
  );
  const noteRow = (note: CoachNote) =>
    row(
      note.id,
      note.date,
      <Pill tone={note.type === "DECISION" ? "accent" : "neutral"}>{t(`Notes.types.${note.type as "NOTE" | "DECISION"}`)}</Pill>,
      note.text,
      <NoteDialog clientId={client.id} today={today} note={note} label={t("Notes.editFrom", { date: day(note.date) })} />,
    );
  const eventText = (event: HistoryEvent) => {
    if (event.type === "PLAN") {
      const plan = event.payload as HistoryPayloads["PLAN"];
      if (plan.change === "MEALS") return t("Notes.plan.MEALS", { dayType: t(`DayTypes.${plan.dayType}`) });
      if (plan.change === "COPY") return t("Notes.plan.COPY", { source: plan.source });
      return t(`Notes.plan.${plan.change}`);
    }
    if (event.type === "TARGETS") {
      const { effectiveFrom, dayTypes } = event.payload as HistoryPayloads["TARGETS"];
      return t("Notes.targets", { date: day(effectiveFrom), dayTypes: dayTypes.map((d) => t(`DayTypes.${d}`)).join(", ") });
    }
    const { from, to } = event.payload as HistoryPayloads["TRACKING_MODE"];
    return t("Notes.trackingMode", { from: t(`TrackingModes.${from}`), to: t(`TrackingModes.${to}`) });
  };
  const eventRow = (event: HistoryEvent) => row(event.id, event.date, <Pill>{t(`Notes.types.${event.type as HistoryType}`)}</Pill>, eventText(event));
  const competitionRow = (competition: FeedCompetition) =>
    row(
      competition.id,
      competition.date,
      <Pill tone="accent">{t("Notes.types.COMPETITION")}</Pill>,
      [competition.name, competition.result && t("Competition.result", { result: competition.result }), competition.felt != null && t("Competition.felt", { felt: competition.felt })].filter(Boolean).join(" · "),
      <Link href={`/coach/clients/${client.id}/competition`} aria-label={t("Notes.competition.openFrom", { name: competition.name })} className="inline-flex h-10 items-center px-2.5 text-sm font-medium hover:underline sm:h-8">
        {t("Notes.checkIn.open")}
      </Link>,
    );
  const checkInRow = (checkIn: FeedCheckIn) =>
    row(
      checkIn.id,
      checkIn.dueDate,
      <Pill tone={checkIn.reviewedAt ? "neutral" : "accent"}>{t("Notes.types.CHECK_IN")}</Pill>,
      checkIn.response ? t("Notes.checkIn.reviewed", { response: checkIn.response }) : t("Notes.checkIn.toReview"),
      <Link href={`/coach/check-ins/${checkIn.id}`} aria-label={t("Notes.checkIn.openFrom", { date: day(checkIn.dueDate) })} className="inline-flex h-10 items-center px-2.5 text-sm font-medium hover:underline sm:h-8">
        {t("Notes.checkIn.open")}
      </Link>,
    );

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {/* Chips, not a second row of underline tabs under the client's tabs. */}
      <nav aria-label={t("Notes.filter")} className="flex gap-2 overflow-x-auto">
        {[undefined, ...FEED_TYPES].map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `${base}?type=${f}` : base}
            aria-current={f === type ? "page" : undefined}
            className="flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink sm:h-8"
          >
            {t(`Notes.filters.${f ?? "all"}`)}
          </Link>
        ))}
      </nav>

      {pinned.length > 0 && (
        <section aria-labelledby="notes-pinned">
          <h2 id="notes-pinned" className="text-base font-semibold">
            {t("Notes.pinned")}
          </h2>
          <ul className="mt-1">{pinned.map(noteRow)}</ul>
        </section>
      )}

      <section aria-labelledby="notes-history">
        <h2 id="notes-history" className="text-base font-semibold">
          {t("Notes.history")}
        </h2>
        {feed.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t(type ? "Notes.emptyFiltered" : "Notes.empty")}</p>
        ) : (
          <ul className="mt-1">{feed.map((item) => ("note" in item ? noteRow(item.note) : "event" in item ? eventRow(item.event) : "checkIn" in item ? checkInRow(item.checkIn) : competitionRow(item.competition)))}</ul>
        )}
      </section>
    </div>
  );
}
