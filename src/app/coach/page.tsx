import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { unreadMessages as unreadMessagesOf } from "@/lib/messages";

// Coach home: tiles land with their features (check-ins waiting, unread messages, calls, competitions, packages, needs attention).
export default async function CoachHome() {
  const coach = await requireCoach();
  const now = new Date();
  const today = todayIn(coach.timezone, now);
  const [t, format, activeClients, checkInsWaiting, competitionsSoon, unreadMessages, callsSoon] = await Promise.all([
    getTranslations("CoachHome"),
    getFormatter(),
    db.client.count({ where: { coachId: coach.id, user: { active: true } } }),
    db.checkIn.count({ where: { reviewedAt: null, client: { coachId: coach.id, user: { active: true } } } }),
    // ponytail: by the coach's calendar; a client a timezone away may be a day off at the edges.
    db.competition.count({ where: { date: { gte: today, lte: addDays(today, 30) }, client: { coachId: coach.id, user: { active: true } } } }),
    unreadMessagesOf(coach),
    db.call.count({ where: { startsAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) }, client: { coachId: coach.id, user: { active: true } } } }),
  ]);
  const tiles = [
    { href: "/coach/clients", label: t("activeClients"), value: activeClients },
    { href: "/coach/check-ins", label: t("checkInsWaiting"), value: checkInsWaiting },
    { href: "/coach/clients?sort=competition", label: t("competitionsSoon"), value: competitionsSoon },
    { href: "/coach/messages", label: t("unreadMessages"), value: unreadMessages },
    { href: "/coach/calendar", label: t("callsSoon"), value: callsSoon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <ul aria-label={t("tiles")} className="grid gap-6 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link href={tile.href} className="flex flex-col gap-1 rounded-lg border bg-card px-5 py-4 transition-colors hover:border-input">
              <span className="text-sm text-muted-foreground">{tile.label}</span>
              <span className="text-2xl tabular-nums">{format.number(tile.value)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
