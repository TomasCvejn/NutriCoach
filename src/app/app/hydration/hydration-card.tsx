import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FluidRing } from "@/components/fluid-ring";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import type { DrinkType } from "@/lib/enums";
import { quickAdd } from "./actions";
import { EditDrinkDialog } from "./forms";

// A day's hydration: the ring against the day's fluid target, the quick +250 / +500 for the client, and the day's drinks
// (editable on the hydration page, read-only for the coach). The caller has authorized the viewer for this client.
export async function HydrationCard({ clientId, date, target, variant }: { clientId: string; date: string; target: number | null; variant: "page" | "home" | "coach" }) {
  const [t, format, logs] = await Promise.all([getTranslations(), getFormatter(), db.fluidLog.findMany({ where: { clientId, date }, orderBy: { createdAt: "asc" } })]);
  const total = logs.reduce((sum, l) => sum + l.ml, 0);
  const n = (value: number) => format.number(value);
  const quick = variant !== "coach" && (
    <div className="flex gap-2">
      {(["250", "500"] as const).map((ml) => (
        <form key={ml} action={quickAdd}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="ml" value={ml} />
          <Button type="submit" variant="outline" className="h-10 px-3 tabular-nums">
            {t("Hydration.quick", { ml })}
          </Button>
        </form>
      ))}
    </div>
  );
  return (
    <section aria-labelledby={`hydration-${variant}`} className="rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`hydration-${variant}`} className="text-base font-semibold">
          {t(variant === "page" ? "Hydration.today" : "Hydration.title")}
        </h2>
        {variant === "home" && (
          <Link href="/app/hydration" className="text-sm font-medium text-primary-ink hover:underline">
            {t("Hydration.open")}
          </Link>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <FluidRing
          value={total}
          target={target}
          label={t("Hydration.ring")}
          valueText={t("Hydration.ml", { ml: n(total) })}
          targetText={target ? t("Hydration.ofTarget", { ml: n(target) }) : t("Hydration.noTarget")}
          size={variant === "page" ? 160 : 120}
        />
        {quick}
      </div>
      {variant !== "home" && (
        logs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("Hydration.empty")}</p>
        ) : (
          <ul className="mt-4">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 border-t border-rule py-2 text-sm">
                <time dateTime={log.createdAt.toISOString()} className="w-12 flex-none text-muted-foreground tabular-nums">
                  {format.dateTime(log.createdAt, { timeStyle: "short" })}
                </time>
                <span className="min-w-0 flex-1">
                  {t(`Hydration.types.${log.drinkType as DrinkType}`)}
                  {(log.sodium != null || log.carbs != null) && (
                    <span className="text-muted-foreground"> · {[log.sodium != null && t("Hydration.sodium", { mg: n(log.sodium) }), log.carbs != null && t("Hydration.carbs", { g: n(log.carbs) })].filter(Boolean).join(" · ")}</span>
                  )}
                </span>
                <span className="flex-none tabular-nums">{t("Hydration.ml", { ml: n(log.ml) })}</span>
                {variant === "page" && <EditDrinkDialog drink={log} label={t("Hydration.editDrink", { time: format.dateTime(log.createdAt, { timeStyle: "short" }) })} />}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
