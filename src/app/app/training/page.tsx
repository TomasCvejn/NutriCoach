import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { TrainingWeek, weekParam } from "./training-week";

// The Training tab (shown when the client trains): the week's sessions and the upcoming ones.
export default async function ClientTraining({ searchParams }: PageProps<"/app/training">) {
  const { user, client } = await requireClient();
  const { week } = weekParam.parse(await searchParams);
  const t = await getTranslations("Training");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <TrainingWeek clientId={client.id} timezone={user.timezone} week={week} base="/app/training" />
    </div>
  );
}
