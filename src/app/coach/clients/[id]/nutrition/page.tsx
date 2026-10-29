import { getFormatter, getTranslations } from "next-intl/server";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { DAY_TYPES, type DayType, type TrackingMode } from "@/lib/enums";
import { latestWeighIn } from "@/lib/body-comp";
import { latestWeight, TARGET_VALUE_FIELDS, targetFor } from "@/lib/nutrition";
import { CopyPlanDialog, MealsEditor, RecommendationsEditor, SpecificsForm } from "./plan-editor";
import { targetSummary } from "@/lib/target-summary";
import { TargetsEditor } from "./targets-editor";

// Nutrition tab (coach): targets, the plan (meals, recommendations, specifics; copy from another client) and the targets'
// history. The daily log joins later.
export default async function ClientNutrition({ params }: PageProps<"/coach/clients/[id]/nutrition">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, format, user, rows, meals, recommendations, others, recipes, weighIn] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { name: true, timezone: true } }),
    db.nutritionTarget.findMany({ where: { clientId: client.id }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
    db.planMeal.findMany({ where: { clientId: client.id }, orderBy: { position: "asc" } }),
    db.planRecommendation.findMany({ where: { clientId: client.id }, orderBy: { position: "asc" } }),
    // "Copy plan from": the coach's other clients.
    db.client.findMany({ where: { coachId: client.coachId, NOT: { id: client.id } }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    // Recipe options for meals: the coach's published recipes (the ones the client can open).
    db.recipe.findMany({ where: { coachId: client.coachId, status: "PUBLISHED" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    latestWeighIn(client.id),
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="targets-title" className="text-lg font-semibold">
              {t("Targets.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`Targets.lead.${mode}`)}</p>
          </div>
          <CopyPlanDialog clientId={client.id} name={user.name} sources={others.map((o) => ({ id: o.id, name: o.user.name }))} />
        </div>
        <div className="mt-5">
          <TargetsEditor
            clientId={client.id}
            mode={mode}
            today={today}
            weightKg={latestWeight(client.weightKg, weighIn)}
            profile={{ sex: client.sex, birthDate: client.birthDate, heightCm: client.heightCm, primaryGoal: client.primaryGoal }}
            current={current}
          />
        </div>
      </section>

      <section aria-labelledby="plan-title">
        <h2 id="plan-title" className="text-lg font-semibold">
          {t("Plan.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Plan.lead")}</p>
        <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <MealsEditor clientId={client.id} mode={mode} meals={meals} recipes={recipes} />
          <div className="flex flex-col gap-6">
            <RecommendationsEditor clientId={client.id} recommendations={recommendations} />
            <SpecificsForm clientId={client.id} specifics={client.planSpecifics} />
          </div>
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
