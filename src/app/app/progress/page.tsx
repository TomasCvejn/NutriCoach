import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { BodyComposition } from "./body-composition";

// The client's progress (More → Progress). The trends dashboard lands above body composition with its item.
export default async function ClientProgress() {
  const { user, client } = await requireClient();
  const t = await getTranslations("Progress");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <BodyComposition clientId={client.id} today={todayIn(user.timezone)} />
    </div>
  );
}
