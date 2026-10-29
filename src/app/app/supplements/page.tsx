import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { SupplementList } from "./supplement-list";

// The client's supplements (More → Supplements): the coach's and their own, by category.
export default async function ClientSupplements() {
  const { user, client } = await requireClient();
  const t = await getTranslations("Supplements");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <SupplementList clientId={client.id} timezone={user.timezone} viewer="client" />
    </div>
  );
}
