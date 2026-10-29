import { ArrowDownIcon, ArrowUpIcon, CopyIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { duplicateScheduleItem, moveScheduleItem } from "@/app/app/competition/schedule-actions";
import { Pill } from "@/components/pill";
import { Button } from "@/components/ui/button";
import type { ScheduleItem } from "@/generated/prisma/client";
import type { ScheduleType } from "@/lib/enums";
import { AMOUNTS, betweenEvents, ordered, type Totals, totals } from "@/lib/schedule";
import { ScheduleItemDialog, ShiftForm } from "./schedule-forms";

// The coach's race-day schedule builder (competition.md): the items in the day's order with their amounts, what the
// fueling between consecutive events adds up to, the day's totals; add, edit, duplicate, move among the same time, shift.
export async function ScheduleBuilder({ competitionId, items, recipes }: { competitionId: string; items: ScheduleItem[]; recipes: { id: string; name: string }[] }) {
  const [t, format] = await Promise.all([getTranslations("Schedule"), getFormatter()]);
  const list = ordered(items);
  const between = new Map(betweenEvents(items).map((b) => [b.after, b.totals]));
  const amounts = (values: Partial<Totals> | ScheduleItem) =>
    AMOUNTS.flatMap((key) => (values[key] ? [t(`amounts.${key}`, { value: format.number(values[key]) })] : [])).join(" · ");
  const icon = "size-10 sm:size-8";

  return (
    <section aria-labelledby="schedule" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 id="schedule" className="text-lg font-semibold">
          {t("title")}
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          {list.length > 0 && <ShiftForm competitionId={competitionId} />}
          <ScheduleItemDialog competitionId={competitionId} recipes={recipes} trigger={<Button className="h-10 px-4 sm:h-8 sm:px-3">{t("add")}</Button>} />
        </div>
      </div>
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <ol aria-label={t("items")}>
            {list.map((item, i) => (
              <li key={item.id} className="border-b border-rule last:border-0">
                <div className="flex items-start gap-3 px-5 py-3">
                  <span className="w-12 flex-none pt-0.5 text-sm font-semibold tabular-nums">{item.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{item.title}</span>
                      <Pill tone={item.type === "EVENT" ? "accent" : "neutral"}>{t(`types.${item.type as ScheduleType}`)}</Pill>
                    </p>
                    {(item.details || amounts(item)) && <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{[item.details, amounts(item)].filter(Boolean).join(" · ")}</p>}
                    {item.recipeId && <p className="text-xs text-muted-foreground">{t("recipe", { name: recipes.find((r) => r.id === item.recipeId)?.name ?? "—" })}</p>}
                  </div>
                  <div className="flex flex-none items-center">
                    {(["up", "down"] as const).map((direction) => {
                      const other = list[i + (direction === "up" ? -1 : 1)];
                      return other?.time === item.time ? (
                        <form key={direction} action={moveScheduleItem}>
                          <input type="hidden" name="competitionId" value={competitionId} />
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="direction" value={direction} />
                          <Button type="submit" variant="ghost" size="icon" className={icon} aria-label={t(direction === "up" ? "moveUp" : "moveDown", { title: item.title })}>
                            {direction === "up" ? <ArrowUpIcon aria-hidden /> : <ArrowDownIcon aria-hidden />}
                          </Button>
                        </form>
                      ) : null;
                    })}
                    <form action={duplicateScheduleItem}>
                      <input type="hidden" name="competitionId" value={competitionId} />
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="ghost" size="icon" className={icon} aria-label={t("duplicate", { title: item.title })}>
                        <CopyIcon aria-hidden />
                      </Button>
                    </form>
                    <ScheduleItemDialog
                      competitionId={competitionId}
                      item={item}
                      recipes={recipes}
                      trigger={
                        <Button variant="ghost" className="h-10 px-2.5 sm:h-8" aria-label={t("editFor", { time: item.time, title: item.title })}>
                          {t("edit")}
                        </Button>
                      }
                    />
                  </div>
                </div>
                {between.has(i) && (
                  <p className="border-t border-dashed border-rule bg-muted/40 px-5 py-2 text-xs text-muted-foreground tabular-nums">
                    {t("between", { amounts: amounts(between.get(i)!) || t("nothing") })}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="border-t px-5 py-3 text-sm tabular-nums">
            <span className="font-medium">{t("dayTotal")}</span> {amounts(totals(list)) || t("nothing")}
          </p>
        </div>
      )}
    </section>
  );
}
