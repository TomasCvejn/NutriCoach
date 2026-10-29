import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { CompetitionList } from "./competition-list";

// The client's competitions (More → Competition, shown with an upcoming or recent one); the coach creates them.
export default async function ClientCompetition() {
  const { user, client } = await requireClient();
  const t = await getTranslations("Competition");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <CompetitionList clientId={client.id} timezone={user.timezone} coach={false} />
    </div>
  );
}
