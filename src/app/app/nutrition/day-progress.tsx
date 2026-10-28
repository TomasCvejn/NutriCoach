import { getFormatter, getTranslations } from "next-intl/server";
import { TargetBar } from "@/components/target-bar";
import { MICRONUTRIENTS } from "@/lib/enums";
import { MACRO_FIELDS, micronutrientTotals, totals } from "@/lib/food-log";
import { TARGET_FIELDS } from "@/lib/nutrition";
import { targetSummary } from "@/lib/target-summary";
import type { Day } from "./day-data";

const PORTION_KINDS = TARGET_FIELDS.PORTIONS;

// A day's progress in the client's mode: CALORIES kcal / macros (+ fiber and sodium) against the targets, PORTIONS hand
// portions against theirs, GUIDANCE the meals followed; the fluid target under the last two. Day screen and home widget.
export async function DayProgress({ day }: { day: Day }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const { mode, target, logged, portions, marks, slots } = day;
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const summary = target && targetSummary(target, mode, t, n);
  const dayTotals = totals(logged);
  const micro = micronutrientTotals(logged);
  const portionTotals = Object.fromEntries(PORTION_KINDS.map((k) => [k, portions.reduce((sum, row) => sum + row[k], 0)])) as Record<(typeof PORTION_KINDS)[number], number>;
  const followedScore = marks.reduce((sum, m) => sum + (m.followed === "YES" ? 1 : m.followed === "PARTLY" ? 0.5 : 0), 0);

  return (
    <>
      {mode === "CALORIES" ? (
        // The day's totals against its targets; a macro without a target shows its total only.
        <div className="mt-4 flex flex-col gap-3">
          {MACRO_FIELDS.map((f) => {
            const unit = f === "kcal" ? "kcal" : "g";
            const goal = target?.[f];
            return goal ? (
              <TargetBar
                key={f}
                label={t(`Calories.bars.${f}`)}
                value={dayTotals[f]}
                target={goal}
                text={t("Calories.ofTarget", { value: n(dayTotals[f]), target: n(goal), unit })}
                // Only kcal past the adherence window is a problem; going over a macro is just shown as over.
                alarm={f === "kcal" && dayTotals.kcal > goal * 1.1 ? t("Calories.over", { value: n(dayTotals.kcal - goal), unit }) : undefined}
              />
            ) : (
              <p key={f} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(`Calories.bars.${f}`)}</span>
                <span className="tabular-nums">{t("Calories.total", { value: n(dayTotals[f]), unit })}</span>
              </p>
            );
          })}
          {!target && <p className="text-xs text-muted-foreground">{t("DailyNutrition.targets")}: {t("DailyNutrition.noTargets")}</p>}
        {/* Fiber and sodium, the only micronutrients tracked: against their targets when set; "incomplete" when some entries lack them. */}
        {(Object.keys(MICRONUTRIENTS) as (keyof typeof MICRONUTRIENTS)[]).map((f) => {
          const goal = target?.[f];
          const unit = MICRONUTRIENTS[f];
          const total = micro[f].total;
          return goal ? (
            <TargetBar key={f} label={t(`Calories.bars.${f}`)} value={total} target={goal} text={t("Calories.ofTarget", { value: n(total), target: n(goal), unit })} />
          ) : (
            <p key={f} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t(`Calories.bars.${f}`)}</span>
              <span className="tabular-nums">{t("Calories.total", { value: n(total), unit })}</span>
            </p>
          );
        })}
        {Object.values(micro).some((m) => m.missing > 0) && <p className="text-xs text-muted-foreground">{t("Calories.incomplete")}</p>}
        </div>
      ) : mode === "PORTIONS" ? (
        // The day's hand portions against the targets; more than one portion over is outside adherence.
        <div className="mt-4 flex flex-col gap-3">
          {PORTION_KINDS.map((k) => {
            const goal = target?.[k];
            return goal != null ? (
              <TargetBar
                key={k}
                label={t(`Targets.fields.${k}`)}
                value={portionTotals[k]}
                target={goal}
                text={t("Portions.ofTarget", { value: n(portionTotals[k]), target: n(goal) })}
                alarm={portionTotals[k] > goal + 1 ? t("Portions.over", { value: n(portionTotals[k] - goal) }) : undefined}
              />
            ) : (
              <p key={k} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t(`Targets.fields.${k}`)}</span>
                <span className="tabular-nums">{n(portionTotals[k])}</span>
              </p>
            );
          })}
        </div>
      ) : (
        <>
          {mode === "GUIDANCE" && (
            // (yes + ½ partly) of the day's planned meals; 75 % and up is an adherent day.
            <div className="mt-4">
              <TargetBar label={t("Guidance.score")} value={followedScore} target={slots.length} text={t("Guidance.scoreText", { value: n(followedScore), total: slots.length })} />
            </div>
          )}
          <p className="mt-3 text-sm tabular-nums">
            <span className="text-muted-foreground">{t("DailyNutrition.targets")}: </span>
            {summary ?? <span className="text-muted-foreground">{t("DailyNutrition.noTargets")}</span>}
          </p>
        </>
      )}
    </>
  );
}
