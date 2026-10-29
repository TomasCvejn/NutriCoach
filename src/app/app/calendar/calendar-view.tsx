import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { ITEM_ICONS } from "@/app/app/upcoming-events";
import { buttonVariants } from "@/components/ui/button";
import { type CalendarItem, loadCalendar } from "@/lib/calendar";
import { addDays, todayIn } from "@/lib/dates";
import type { SessionType } from "@/lib/enums";
import { weekStarts } from "@/lib/progress";

export const calendarParams = z.object({
  view: z.enum(["week", "month"]).catch("week"),
  date: z.iso.date().optional().catch(undefined),
  client: z.string().optional().catch(undefined),
});

type Client = Parameters<typeof loadCalendar>[0][number] & { name: string };
// Each type's colour, always with its icon and the legend (colour is never the only cue).
const TONES: Record<CalendarItem["type"], string> = { SESSION: "border-primary text-primary", COMPETITION: "border-warning text-warning", CALL: "border-positive text-positive", CHECK_IN: "border-muted-foreground text-muted-foreground" };

// The calendar (home-and-basics.md) for the client (their own) and the coach (every client, `coach` names them): a week
// (Monday first) or a month around `date`, sessions, competitions, calls and check-in days, each leading to its page.
// `keep`: other search params the page keeps across the calendar's own links (the coach's client filter).
export async function CalendarView({ clients, timezone, view, date, base, keep = {}, coach }: { clients: Client[]; timezone: string; view: "week" | "month"; date?: string; base: string; keep?: Record<string, string>; coach: boolean }) {
  const today = todayIn(timezone);
  const anchor = date ?? today;
  const first = view === "week" ? weekStarts(anchor, 1)[0] : weekStarts(`${anchor.slice(0, 8)}01`, 1)[0];
  const monthEnd = addDays(`${addDays(`${anchor.slice(0, 8)}01`, 32).slice(0, 8)}01`, -1);
  const last = view === "week" ? addDays(first, 6) : addDays(weekStarts(monthEnd, 1)[0], 6);
  const [t, format, items] = await Promise.all([getTranslations(), getFormatter(), loadCalendar(clients, first, last, timezone)]);
  const days = Array.from({ length: (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1 }, (_, i) => addDays(first, i));
  const name = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? "";
  const step = (by: number) => (view === "week" ? addDays(first, 7 * by) : `${addDays(`${anchor.slice(0, 8)}01`, by > 0 ? 32 : -1).slice(0, 8)}01`);
  const href = (change: Record<string, string>) => `${base}?${new URLSearchParams({ ...keep, view, date: anchor, ...change })}`;

  const describe = (i: CalendarItem): { title: string; href?: string; external?: boolean } => {
    const area = coach ? `/coach/clients/${i.clientId}` : "/app";
    if (i.type === "SESSION")
      return { title: `${t(`Training.types.${i.session.type as SessionType}`)} · ${t("Training.minutes", { count: i.session.durationMin })}`, href: coach ? `${area}/training/${i.session.id}` : `/app/training/${i.session.id}` };
    if (i.type === "COMPETITION") return { title: i.competition.name, href: coach ? `${area}/competition/${i.competition.id}` : `/app/competition/${i.competition.id}` };
    if (i.type === "CALL") return coach ? { title: t("Calendar.callWith"), href: area } : { title: t("Calendar.call"), href: i.call.link ?? undefined, external: true };
    return { title: t("Calendar.checkIn"), href: coach ? `${area}/check-ins` : "/app/check-in" };
  };
  const entry = (i: CalendarItem, compact: boolean, n: number) => {
    const { title, href, external } = describe(i);
    const Icon = ITEM_ICONS[i.type];
    const label = (
      <>
        <span className="sr-only">{t(`Calendar.types.${i.type}`)}: </span>
        {i.time && <span className="tabular-nums">{i.time} </span>}
        <span className="font-medium text-foreground">{title}</span>
        {coach && <span className="text-muted-foreground"> · {name(i.clientId)}</span>}
      </>
    );
    return (
      <li key={n} className={`flex items-start gap-1.5 border-l-[3px] pl-1.5 text-xs leading-5 ${TONES[i.type]}`}>
        <Icon aria-hidden className="mt-0.5 size-3.5 flex-none" />
        <span className={`min-w-0 text-muted-foreground ${compact ? "truncate max-sm:sr-only" : ""}`}>
          {href ? (
            <Link href={href} className="hover:underline" {...(external && { target: "_blank", rel: "noopener noreferrer" })}>
              {label}
            </Link>
          ) : (
            label
          )}
        </span>
      </li>
    );
  };
  const range =
    view === "week"
      ? format.dateTimeRange(new Date(first), new Date(last), { day: "numeric", month: "long", timeZone: "UTC" })
      : format.dateTime(new Date(`${anchor.slice(0, 8)}01`), { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("Calendar.period")} className="flex items-center gap-1">
          <Link href={href({ date: step(-1) })} aria-label={t("Calendar.previous")} className={buttonVariants({ variant: "ghost", size: "icon", className: "size-10" })}>
            <ChevronLeftIcon aria-hidden />
          </Link>
          <h2 className="min-w-44 text-center text-base font-semibold first-letter:uppercase">{range}</h2>
          <Link href={href({ date: step(1) })} aria-label={t("Calendar.next")} className={buttonVariants({ variant: "ghost", size: "icon", className: "size-10" })}>
            <ChevronRightIcon aria-hidden />
          </Link>
          {!days.includes(today) && (
            <Link href={href({ date: today })} className="ml-1 text-sm font-medium text-primary-ink hover:underline">
              {t("Calendar.today")}
            </Link>
          )}
        </nav>
        <nav aria-label={t("Calendar.view")} className="flex gap-2">
          {(["week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-current={v === view ? "page" : undefined}
              className="flex h-10 items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink sm:h-8"
            >
              {t(`Calendar.views.${v}`)}
            </Link>
          ))}
        </nav>
      </div>

      <ul aria-label={t("Calendar.legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(TONES) as CalendarItem["type"][]).map((type) => {
          const Icon = ITEM_ICONS[type];
          return (
            <li key={type} className={`flex items-center gap-1.5 border-l-[3px] pl-1.5 ${TONES[type]}`}>
              <Icon aria-hidden className="size-3.5" />
              <span className="text-muted-foreground">{t(`Calendar.types.${type}`)}</span>
            </li>
          );
        })}
      </ul>

      {view === "week" ? (
        <ol aria-label={t("Calendar.week")} className="grid gap-px overflow-hidden rounded-lg border bg-rule lg:grid-cols-7">
          {days.map((day) => {
            const own = items.filter((i) => i.date === day);
            return (
              <li key={day} aria-current={day === today ? "date" : undefined} className="flex min-h-24 flex-col gap-2 bg-card p-3 aria-[current=date]:bg-primary-soft/40">
                <p className="text-sm first-letter:uppercase">
                  <span className={day === today ? "font-semibold text-primary-ink" : "font-medium"}>{format.dateTime(new Date(day), { weekday: "short", timeZone: "UTC" })}</span>{" "}
                  <span className="text-muted-foreground tabular-nums">{format.dateTime(new Date(day), { day: "numeric", month: "numeric", timeZone: "UTC" })}</span>
                </p>
                {own.length > 0 ? <ul className="flex flex-col gap-1.5">{own.map((i, n) => entry(i, false, n))}</ul> : <p className="text-xs text-muted-foreground lg:sr-only">{t("Calendar.nothing")}</p>}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-rule">
          <div aria-hidden className="grid grid-cols-7 gap-px text-center text-xs text-muted-foreground">
            {days.slice(0, 7).map((day) => (
              <span key={day} className="bg-card py-1.5 first-letter:uppercase">
                {format.dateTime(new Date(day), { weekday: "short", timeZone: "UTC" })}
              </span>
            ))}
          </div>
          <ol aria-label={t("Calendar.month")} className="grid grid-cols-7 gap-px">
            {days.map((day) => {
              const own = items.filter((i) => i.date === day);
              const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
              return (
                <li
                  key={day}
                  aria-current={day === today ? "date" : undefined}
                  aria-label={format.dateTime(new Date(day), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                  className={`flex min-h-20 flex-col gap-1 p-1.5 sm:min-h-28 sm:p-2 ${inMonth ? "bg-card" : "bg-muted/40"} aria-[current=date]:bg-primary-soft/40`}
                >
                  <span className={`text-xs tabular-nums ${day === today ? "font-semibold text-primary-ink" : inMonth ? "" : "text-muted-foreground"}`}>{Number(day.slice(8))}</span>
                  {own.length > 0 && <ul className="flex flex-col gap-1">{own.slice(0, 3).map((i, n) => entry(i, true, n))}</ul>}
                  {own.length > 3 && <span className="text-xs text-muted-foreground">{t("Calendar.more", { count: own.length - 3 })}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
