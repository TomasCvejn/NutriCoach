import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";

// Coach home: tiles land with their features (check-ins waiting, unread messages, calls, competitions, packages, needs attention).
export default async function CoachHome() {
  const coach = await requireCoach();
  const [t, format, activeClients] = await Promise.all([
    getTranslations("CoachHome"),
    getFormatter(),
    db.client.count({ where: { coachId: coach.id, user: { active: true } } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <ul aria-label={t("tiles")} className="grid gap-6 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
        <li>
          <Link href="/coach/clients" className="flex flex-col gap-1 rounded-lg border bg-card px-5 py-4 transition-colors hover:border-input">
            <span className="text-sm text-muted-foreground">{t("activeClients")}</span>
            <span className="text-2xl tabular-nums">{format.number(activeClients)}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
