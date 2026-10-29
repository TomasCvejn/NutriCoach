import { getTranslations } from "next-intl/server";
import { requireCoach } from "@/lib/auth";
import { FuelingEditor } from "../fueling-editor";

export default async function NewFuelingTemplate() {
  await requireCoach();
  const t = await getTranslations("Fueling");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("newTitle")}</h2>
      <FuelingEditor />
    </div>
  );
}
