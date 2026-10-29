import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import { FuelingEditor } from "../fueling-editor";

export default async function EditFuelingTemplate({ params }: PageProps<"/coach/library/fueling/[id]">) {
  const coach = await requireCoach();
  const template = await db.fuelingTemplate.findFirst({ where: { id: (await params).id, coachId: coach.id } });
  if (!template) notFound();
  const t = await getTranslations("Fueling");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("editTitle", { name: template.name })}</h2>
      <FuelingEditor template={template} />
    </div>
  );
}
