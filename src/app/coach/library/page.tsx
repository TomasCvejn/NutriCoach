import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { FoodDialog } from "@/app/app/nutrition/food-dialog";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Serving } from "@/lib/foods";

// Library → Foods: the coach's own foods (their clients log them) and, read-only, the foods their clients made.
export default async function LibraryFoods() {
  const coach = await requireCoach();
  const [t, format, foods, clientFoods] = await Promise.all([
    getTranslations("Foods"),
    getFormatter(),
    db.food.findMany({ where: { source: "COACH", ownerId: coach.id }, orderBy: { name: "asc" } }),
    db.food.findMany({
      where: { source: "CLIENT", owner: { client: { coachId: coach.id } } },
      include: { owner: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const n = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const macros = ["kcal", "protein", "carbs", "fat"] as const;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="foods-own">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="foods-own" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("lead")}</p>
          </div>
          <FoodDialog trigger={<Button className="h-10 px-3 sm:h-9">{t("add")}</Button>} />
        </div>
        {foods.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 text-left font-normal">{t("columns.name")}</th>
                {macros.map((m) => (
                  <th key={m} className="hidden w-24 py-2 text-right font-normal sm:table-cell">
                    {t(`columns.${m}`)}
                  </th>
                ))}
                <th className="hidden w-48 py-2 pl-6 text-left font-normal lg:table-cell">{t("columns.servings")}</th>
                <th className="w-20 py-2">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => (
                <tr key={food.id} className="border-t border-rule">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{food.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[food.brand, t("per100Line", { kcal: n(food.kcal), protein: n(food.protein), carbs: n(food.carbs), fat: n(food.fat) })].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  {macros.map((m) => (
                    <td key={m} className="hidden py-3 text-right tabular-nums sm:table-cell">
                      {n(food[m])}
                    </td>
                  ))}
                  <td className="hidden py-3 pl-6 text-muted-foreground lg:table-cell">
                    {(food.servings as Serving[]).map((s) => t("serving", { label: s.label, grams: n(s.grams) })).join(", ") || "—"}
                  </td>
                  <td className="py-3 text-right">
                    <FoodDialog
                      food={food}
                      trigger={
                        <Button variant="ghost" className="h-10 px-2.5 sm:h-8" aria-label={t("editFood", { name: food.name })}>
                          {t("edit")}
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="foods-clients" className="max-w-3xl">
        <h2 id="foods-clients" className="text-lg font-semibold">
          {t("clientFoods")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("clientFoodsLead")}</p>
        {clientFoods.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("clientFoodsEmpty")}</p>
        ) : (
          <ul className="mt-2">
            {clientFoods.map((food) => (
              <li key={food.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{food.name}</span>
                  {food.brand && <span className="text-muted-foreground"> · {food.brand}</span>}
                  <span className="block text-xs text-muted-foreground">{food.owner?.name}</span>
                </span>
                <span className="flex-none text-muted-foreground tabular-nums">{t("kcalPer100", { kcal: n(food.kcal) })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
