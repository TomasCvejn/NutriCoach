import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { Thread } from "./thread";

// Messages tab: the client's thread with their coach.
export default async function ClientMessages() {
  const { user, client } = await requireClient();
  const t = await getTranslations("Messages");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("titleClient")}</h1>
      <Thread clientId={client.id} viewer={user} contextHref={(type, key) => (type === "NUTRITION_DAY" ? `/app/nutrition?date=${key}` : `/app/check-in/${key}`)} />
    </div>
  );
}
