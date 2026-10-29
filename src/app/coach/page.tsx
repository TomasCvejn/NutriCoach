import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { requireCoach } from "@/lib/auth";
import type { AttentionReason } from "@/lib/client-list";
import { coachHome } from "@/lib/coach-home";

// Where each reason leads: to the thing to do about it.
const REASON_HREF: Record<AttentionReason, (clientId: string) => string> = {
  NOT_LOGGED: (id) => `/coach/clients/${id}/nutrition/log`,
  CHECK_IN_OVERDUE: (id) => `/coach/clients/${id}/check-ins`,
  CHECK_IN_TO_REVIEW: () => "/coach/check-ins",
  UNREAD: (id) => `/coach/messages?client=${id}`,
  NO_PLAN: (id) => `/coach/clients/${id}/nutrition`,
};

// Coach home (coach.md): the tiles, the clients who need attention (each reason leads to what to do), and the
// competitions of the next 30 days.
export default async function CoachHome() {
  const coach = await requireCoach();
  const [t, format, home] = await Promise.all([getTranslations("CoachHome"), getFormatter(), coachHome(coach)]);
  const tiles = [
    { href: "/coach/clients", label: t("activeClients"), value: home.activeClients },
    { href: "/coach/check-ins", label: t("checkInsWaiting"), value: home.checkInsWaiting },
    { href: "/coach/messages", label: t("unreadMessages"), value: home.unreadMessages },
    { href: "/coach/calendar", label: t("callsSoon"), value: home.callsSoon },
    { href: "/coach/clients?sort=competition", label: t("competitionsSoon"), value: home.competitions.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <ul aria-label={t("tiles")} className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] sm:gap-6">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link href={tile.href} className="flex h-full flex-col gap-1 rounded-lg border bg-card px-5 py-4 transition-colors hover:border-input">
              <span className="text-sm text-muted-foreground">{tile.label}</span>
              <span className="text-2xl tabular-nums">{format.number(tile.value)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="home-attention" className="rounded-lg border bg-card p-5">
          <h2 id="home-attention" className="text-base font-semibold">
            {t("attention")}
          </h2>
          {home.attention.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("allGood")}</p>
          ) : (
            <ul className="mt-2">
              {home.attention.map(({ row, reasons }) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-3 first:border-0">
                  <Link href={`/coach/clients/${row.id}`} className="text-sm font-medium hover:underline">
                    {row.name}
                  </Link>
                  <span className="flex flex-wrap gap-2">
                    {reasons.map((reason) => (
                      <Link key={reason} href={REASON_HREF[reason](row.id)} className="rounded-sm hover:underline">
                        <Pill tone={reason === "CHECK_IN_OVERDUE" || reason === "NOT_LOGGED" ? "warning" : "accent"}>
                          {t(`reasons.${reason}`, { days: row.daysAgo ?? row.daysSinceOnboarding ?? 0, count: row.unread })}
                        </Pill>
                      </Link>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-competitions" className="rounded-lg border bg-card p-5">
          <h2 id="home-competitions" className="text-base font-semibold">
            {t("competitionsSoon")}
          </h2>
          {home.competitions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("noCompetitions")}</p>
          ) : (
            <ul className="mt-2">
              {home.competitions.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 border-t border-rule py-2.5 text-sm first:border-0">
                  <Link href={`/coach/clients/${c.clientId}/competition/${c.id}`} className="min-w-0 hover:underline">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.client}</span>
                  </Link>
                  <span className="flex-none tabular-nums">{t("inDays", { days: c.days })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
