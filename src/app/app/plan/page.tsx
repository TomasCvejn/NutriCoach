import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { DAY_TYPES, type TrackingMode } from "@/lib/enums";
import { RecipeLinks } from "../nutrition/recipe-links";
import { dayType as dayTypeOf, TARGET_FIELDS, type TargetField, targetFor } from "@/lib/nutrition";

const params = z.object({ day: z.enum(DAY_TYPES).optional().catch(undefined) });

// How each target number reads: kcal and grams with their unit, hand portions counted in words.
const UNIT: Record<TargetField, string> = {
  ...{ kcal: "kcal", protein: "g", carbs: "g", fat: "g", fiber: "g", sodium: "mg", fluidMl: "ml" },
  ...{ palms: "palms", hands: "hands", fists: "fists", thumbs: "thumbs" },
};

// The client's plan (More → Plan): the targets of a day type in the client's mode, its meals, the coach's
// recommendations and specifics. Opens on today's day type; the other day types the plan covers are one tap away.
export default async function ClientPlan({ searchParams }: PageProps<"/app/plan">) {
  const { user, client } = await requireClient();
  const [t, format, targets, meals, recommendations, recipes] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.nutritionTarget.findMany({ where: { clientId: client.id } }),
    db.planMeal.findMany({ where: { clientId: client.id }, orderBy: { position: "asc" } }),
    db.planRecommendation.findMany({ where: { clientId: client.id }, orderBy: { position: "asc" } }),
    db.recipe.findMany({ where: { coachId: client.coachId, status: "PUBLISHED" }, select: { id: true, name: true } }),
  ]);
  const mode = client.trackingMode as TrackingMode;
  const today = todayIn(user.timezone);
  // ponytail: overrides, sessions and competitions don't exist yet, so today is REST until their items pass them in.
  const todayType = dayTypeOf({});
  // The day types this plan says something about (and today's), in the usual order.
  const covered = DAY_TYPES.filter((d) => d === "REST" || d === todayType || targets.some((r) => r.dayType === d) || meals.some((m) => m.dayType === d));
  const selected = (await params.parseAsync(await searchParams)).day ?? todayType;
  const target = targetFor(targets, today, selected); // a training / competition day without its own target uses the rest day's
  const dayMeals = meals.filter((m) => m.dayType === selected);
  const value = (field: TargetField) => {
    const v = target?.[field];
    return v == null ? null : t(`ClientPlan.units.${UNIT[field]}`, { value: v, formatted: format.number(v) });
  };
  const numbers = mode === "GUIDANCE" ? [] : TARGET_FIELDS[mode].filter((f) => value(f) != null && f !== "kcal");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("ClientPlan.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(`ClientPlan.lead.${mode}`)}</p>
      </header>

      {covered.length > 1 && (
        <nav aria-label={t("ClientPlan.dayType")} className="-mt-2 flex gap-2 overflow-x-auto">
          {covered.map((d) => (
            <Link
              key={d}
              href={`/app/plan?day=${d}`}
              aria-current={d === selected ? "page" : undefined}
              className="flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink"
            >
              {d === todayType ? t("ClientPlan.today", { dayType: t(`DayTypes.${d}`) }) : t(`DayTypes.${d}`)}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="plan-targets" className="rounded-lg border bg-card p-5">
        <h2 id="plan-targets" className="text-base font-semibold">
          {t("ClientPlan.targets", { dayType: t(`DayTypes.${selected}`) })}
        </h2>
        {!target ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("ClientPlan.noTargets")}</p>
        ) : (
          <>
            {mode === "CALORIES" && value("kcal") && <p className="mt-3 text-3xl font-semibold tabular-nums">{value("kcal")}</p>}
            {mode === "GUIDANCE" && <p className="mt-2 text-sm text-muted-foreground">{t("ClientPlan.guidance")}</p>}
            <dl className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-x-6 gap-y-4">
              {[...numbers, ...(value("fluidMl") ? (["fluidMl"] as const) : [])].map((field) => (
                <div key={field} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t(`ClientPlan.fields.${field}`)}</dt>
                  <dd className="text-lg font-medium tabular-nums">{value(field)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="plan-meals" className="rounded-lg border bg-card p-5">
          <h2 id="plan-meals" className="text-base font-semibold">
            {t("ClientPlan.meals")}
          </h2>
          {dayMeals.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("ClientPlan.noMeals")}</p>
          ) : (
            <ol className="mt-2">
              {dayMeals.map((meal) => (
                <li key={meal.id} className="border-b border-rule py-3 last:border-b-0 last:pb-0">
                  <p className="text-sm">
                    <span className="font-medium">{meal.name}</span>
                    {meal.timeHint && <span className="text-muted-foreground"> · {meal.timeHint}</span>}
                  </p>
                  {mode === "PORTIONS" && TARGET_FIELDS.PORTIONS.some((f) => meal[f] != null) && (
                    <p className="mt-0.5 text-sm tabular-nums">
                      {TARGET_FIELDS.PORTIONS.flatMap((f) => (meal[f] ? [t(`ClientPlan.units.${UNIT[f]}`, { value: meal[f], formatted: format.number(meal[f]) })] : [])).join(" · ")}
                    </p>
                  )}
                  {meal.guidance && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{meal.guidance}</p>}
                  {meal.note && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{meal.note}</p>}
                  <RecipeLinks ids={meal.recipeIds as string[]} recipes={recipes} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="plan-recommendations" className="rounded-lg border bg-card p-5">
            <h2 id="plan-recommendations" className="text-base font-semibold">
              {t("ClientPlan.recommendations")}
            </h2>
            {recommendations.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("ClientPlan.noRecommendations")}</p>
            ) : (
              <ul className="mt-2">
                {recommendations.map((r) => (
                  <li key={r.id} className="border-b border-rule py-3 last:border-b-0 last:pb-0">
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.text && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{r.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {client.planSpecifics && (
            <section aria-labelledby="plan-specifics" className="rounded-lg border bg-card p-5">
              <h2 id="plan-specifics" className="text-base font-semibold">
                {t("ClientPlan.specifics")}
              </h2>
              <p className="mt-2 text-sm whitespace-pre-line">{client.planSpecifics}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
