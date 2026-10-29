import { CalendarCheckIcon, ActivityIcon, PhoneIcon, TrophyIcon, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { CalendarItem } from "@/lib/calendar";
import type { SessionType } from "@/lib/enums";

export const ITEM_ICONS: Record<CalendarItem["type"], LucideIcon> = { SESSION: ActivityIcon, COMPETITION: TrophyIcon, CALL: PhoneIcon, CHECK_IN: CalendarCheckIcon };

// Client home widget 8: the next seven days' sessions, calls, check-in day and competitions, each leading to its page (a
// call to its meeting link).
export async function UpcomingEvents({ items, today }: { items: CalendarItem[]; today: string }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const day = (date: string) => (date === today ? t("Calendar.today") : format.dateTime(new Date(date), { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }));
  const item = (i: CalendarItem): { title: string; href?: string; external?: boolean } => {
    if (i.type === "SESSION") return { title: `${t(`Training.types.${i.session.type as SessionType}`)} · ${t("Training.minutes", { count: i.session.durationMin })}`, href: `/app/training/${i.session.id}` };
    if (i.type === "COMPETITION") return { title: i.competition.name, href: `/app/competition/${i.competition.id}` };
    if (i.type === "CALL") return { title: t("Calendar.call"), href: i.call.link ?? undefined, external: true };
    return { title: t("Calendar.checkIn"), href: "/app/check-in" };
  };

  return (
    <section aria-labelledby="home-upcoming" className="rounded-lg border bg-card p-5">
      <h2 id="home-upcoming" className="text-base font-semibold">
        {t("ClientHome.upcoming")}
      </h2>
      <ul className="mt-2">
        {items.map((i, n) => {
          const { title, href, external } = item(i);
          const Icon = ITEM_ICONS[i.type];
          return (
            <li key={n} className="flex items-center gap-3 border-t border-rule py-2 text-sm first:border-0">
              <span className="w-20 flex-none text-muted-foreground first-letter:uppercase">{day(i.date)}</span>
              <Icon aria-hidden className="size-4 flex-none text-muted-foreground" />
              <span className="sr-only">{t(`Calendar.types.${i.type}`)}:</span>
              <span className="min-w-0 flex-1 truncate">
                {i.time && <span className="mr-1.5 tabular-nums">{i.time}</span>}
                {href ? (
                  <Link href={href} className="font-medium hover:underline" {...(external && { target: "_blank", rel: "noopener noreferrer" })}>
                    {title}
                  </Link>
                ) : (
                  <span className="font-medium">{title}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
