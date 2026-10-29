import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Intensity, SessionType } from "@/lib/enums";

// Library → Fueling: the coach's templates, highest priority first, each with its rule and its "during" amounts.
export default async function LibraryFueling() {
  const coach = await requireCoach();
  const [t, tt, templates] = await Promise.all([
    getTranslations("Fueling"),
    getTranslations("Training"),
    db.fuelingTemplate.findMany({ where: { coachId: coach.id }, orderBy: [{ priority: "desc" }, { name: "asc" }] }),
  ]);
  const rule = (template: (typeof templates)[number]) =>
    [
      (template.sessionTypes as SessionType[]).map((type) => tt(`types.${type}`)).join(", ") || t("anyTypeShort"),
      template.minDurationMin != null && template.maxDurationMin != null
        ? t("rule.between", { min: template.minDurationMin, max: template.maxDurationMin })
        : template.minDurationMin != null
          ? t("rule.atLeast", { min: template.minDurationMin })
          : template.maxDurationMin != null && t("rule.atMost", { max: template.maxDurationMin }),
      template.minIntensity && t("rule.intensity", { intensity: tt(`intensities.${template.minIntensity as Intensity}`) }),
    ]
      .filter(Boolean)
      .join(" · ");
  const during = (template: (typeof templates)[number]) =>
    [
      template.duringCarbsPerHour != null && `${template.duringCarbsPerHour} g/h`,
      template.duringFluidPerHour != null && `${template.duringFluidPerHour} ml/h`,
      template.duringSodiumPerHour != null && `${template.duringSodiumPerHour} mg/h`,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <section aria-labelledby="fueling-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="fueling-title" className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <Link href="/coach/library/fueling/new" className={buttonVariants({ className: "h-10 px-3 sm:h-9" })}>
          {t("new")}
        </Link>
      </div>
      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-2 text-left font-normal">{t("columns.name")}</th>
              <th className="hidden py-2 text-left font-normal md:table-cell">{t("columns.during")}</th>
              <th className="w-20 py-2 text-right font-normal">{t("columns.priority")}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id} className="border-t border-rule">
                <td className="py-3 pr-4">
                  <Link href={`/coach/library/fueling/${template.id}`} className="font-medium hover:underline">
                    {template.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{rule(template)}</span>
                </td>
                <td className="hidden py-3 pr-4 tabular-nums md:table-cell">{during(template)}</td>
                <td className="py-3 text-right tabular-nums">{template.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
