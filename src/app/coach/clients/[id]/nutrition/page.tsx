import { getFormatter, getTranslations } from "next-intl/server";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { DAY_TYPES, type DayType, type TrackingMode } from "@/lib/enums";
import { latestWeight, TARGET_VALUE_FIELDS, targetFor } from "@/lib/nutrition";
import { targetSummary } from "./target-summary";
import { TargetsEditor } from "./targets-editor";

// Nutrition tab (coach): the targets editor and the targets' history. Meals, recommendations and the daily log join later.
export default async function ClientNutrition({ params }: PageProps<"/coach/clients/[id]/nutrition">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, format, user, rows] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } }),
    db.nutritionTarget.findMany({ where: { clientId: client.id }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const today = todayIn(user.timezone);
  const values = (row: (typeof rows)[number] | undefined) => (row ? Object.fromEntries(TARGET_VALUE_FIELDS.map((f) => [f, row[f]])) : null);
  // Each day type's own row in force today (no REST fallback: an empty training column means "as the rest day").
  const current = Object.fromEntries(DAY_TYPES.map((d) => [d, values(targetFor(rows.filter((r) => r.dayType === d), today, d))])) as Record<DayType, ReturnType<typeof values>>;
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const day = (date: string) => format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="targets-title">
        <h2 id="targets-title" className="text-lg font-semibold">
          {t("Targets.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(`Targets.lead.${mode}`)}</p>
        <div className="mt-5">
          <TargetsEditor
            clientId={client.id}
            mode={mode}
            today={today}
            weightKg={latestWeight(client.weightKg)}
            profile={{ sex: client.sex, birthDate: client.birthDate, heightCm: client.heightCm, primaryGoal: client.primaryGoal }}
            current={current}
          />
        </div>
      </section>

      <section aria-labelledby="targets-history" className="max-w-3xl">
        <h2 id="targets-history" className="text-lg font-semibold">
          {t("Targets.history")}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Targets.historyEmpty")}</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-32 py-2 font-normal">{t("Targets.effectiveFrom")}</th>
                <th className="w-40 py-2 font-normal">{t("Targets.dayType")}</th>
                <th className="py-2 font-normal">{t("Targets.values")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-rule align-top">
                  <td className="py-2.5 pr-4 tabular-nums">{day(row.effectiveFrom)}</td>
                  <td className="py-2.5 pr-4">{t(`DayTypes.${row.dayType as DayType}`)}</td>
                  <td className="py-2.5 tabular-nums">{targetSummary(row, mode, t, number) ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
