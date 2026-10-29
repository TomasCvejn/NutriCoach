import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { BodyComposition } from "./body-composition";
import { ProgressDashboard, rangeParam } from "./dashboard";

// The client's progress (More → Progress): the trends over the chosen range, then body composition.
export default async function ClientProgress({ searchParams }: PageProps<"/app/progress">) {
  const { user, client } = await requireClient();
  const { range } = rangeParam.parse(await searchParams);
  const t = await getTranslations("Progress");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <ProgressDashboard client={client} timezone={user.timezone} weeks={range} base="/app/progress" />
      <BodyComposition clientId={client.id} today={todayIn(user.timezone)} />
    </div>
  );
}
