import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { CompetitionList } from "./competition-list";
import { CompetitionSummary } from "./competition-summary";

// The client's competition dashboard (More → Competition, shown with an upcoming or recent one): the next competition at
// a glance, then all of them; the coach creates them.
export default async function ClientCompetition() {
  const { user, client } = await requireClient();
  const today = todayIn(user.timezone);
  const [t, next] = await Promise.all([
    getTranslations("Competition"),
    db.competition.findFirst({ where: { clientId: client.id, date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      {next && <CompetitionSummary competition={next} today={today} />}
      <CompetitionList clientId={client.id} timezone={user.timezone} coach={false} except={next?.id} />
    </div>
  );
}
