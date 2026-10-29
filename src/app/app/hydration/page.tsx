import { XIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import type { SessionType } from "@/lib/enums";
import { featuresOf } from "@/lib/features";
import { TargetBar } from "@/components/target-bar";
import { FALLBACK_SLOTS, loadDay } from "../nutrition/day-data";
import { deletePreset, logPreset } from "./actions";
import { AddDrinkDialog, SavePresetDialog } from "./forms";
import { HydrationCard } from "./hydration-card";

// Hydration (More → Hydration): today's drinks against the day's fluid target, quick adds, a drink of any kind, "My drinks".
// ponytail: today only; a past day's drinks show in its nutrition day (and to the coach).
export default async function ClientHydration() {
  const { user, client } = await requireClient();
  const today = todayIn(user.timezone);
  const [t, format, day, presets, drinks, { training }] = await Promise.all([
    getTranslations(),
    getFormatter(),
    loadDay(client.id, today, [...FALLBACK_SLOTS]),
    db.drinkPreset.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
    db.fluidLog.aggregate({ where: { clientId: client.id, date: today }, _sum: { sodium: true } }),
    featuresOf(client, today),
  ]);
  const sessionSodium = day.sessions.reduce((sum, s) => sum + (s.totals?.sodiumMg ?? 0), 0);
  const n = (value: number) => format.number(value);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Hydration.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Hydration.lead")}</p>
        </div>
        <AddDrinkDialog date={today} />
      </header>
      <HydrationCard clientId={client.id} date={today} target={day.fluidTarget} variant="page" />
      {/* For a client who trains: today's sessions with their fluid and sodium, and the drinks' sodium against it. */}
      {training && (
        <section aria-labelledby="hydration-training" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
          <h2 id="hydration-training" className="text-base font-semibold">
            {t("Hydration.training")}
          </h2>
          {day.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ClientHome.trainingNone")}</p>
          ) : (
            <>
              <ul>
                {day.sessions.map(({ session, plan, totals }) => (
                  <li key={session.id} className="flex flex-col gap-0.5 border-t border-rule py-2 text-sm first:border-0">
                    <span className="flex justify-between gap-3">
                      <span className="font-medium">
                        {t(`Training.types.${session.type as SessionType}`)} · {t("Training.minutes", { count: session.durationMin })}
                      </span>
                      <span className="tabular-nums">
                        {totals
                          ? [totals.fluidMl != null && t("Hydration.ml", { ml: n(totals.fluidMl) }), totals.sodiumMg != null && t("Hydration.sodium", { mg: n(totals.sodiumMg) })].filter(Boolean).join(" · ") || "—"
                          : t("Training.noFuelingShort")}
                      </span>
                    </span>
                    {plan?.duringText && <span className="text-muted-foreground">{plan.duringText}</span>}
                  </li>
                ))}
              </ul>
              {sessionSodium > 0 && (
                <TargetBar
                  label={t("Hydration.electrolytes")}
                  value={drinks._sum.sodium ?? 0}
                  target={sessionSodium}
                  text={t("Hydration.electrolytesText", { value: n(drinks._sum.sodium ?? 0), target: n(sessionSodium) })}
                />
              )}
            </>
          )}
        </section>
      )}
      <section aria-labelledby="my-drinks" className="flex flex-col gap-3 rounded-lg border bg-card p-5">
        <h2 id="my-drinks" className="text-base font-semibold">
          {t("Hydration.myDrinks")}
        </h2>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Hydration.noPresets")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center rounded-full border bg-card">
                <form action={logPreset}>
                  <input type="hidden" name="presetId" value={p.id} />
                  <input type="hidden" name="date" value={today} />
                  <Button type="submit" variant="ghost" className="h-10 rounded-full px-3.5 tabular-nums" aria-label={t("Hydration.logPreset", { name: p.name })}>
                    {p.name} · {t("Hydration.ml", { ml: format.number(p.ml) })}
                  </Button>
                </form>
                <form action={deletePreset}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="ghost" size="icon" className="size-10 rounded-full text-muted-foreground" aria-label={t("Hydration.deletePreset", { name: p.name })}>
                    <XIcon aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <SavePresetDialog />
      </section>
    </div>
  );
}
