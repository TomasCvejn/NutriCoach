import { XIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { FALLBACK_SLOTS, loadDay } from "../nutrition/day-data";
import { deletePreset, logPreset } from "./actions";
import { AddDrinkDialog, SavePresetDialog } from "./forms";
import { HydrationCard } from "./hydration-card";

// Hydration (More → Hydration): today's drinks against the day's fluid target, quick adds, a drink of any kind, "My drinks".
// ponytail: today only; a past day's drinks show in its nutrition day (and to the coach).
export default async function ClientHydration() {
  const { user, client } = await requireClient();
  const today = todayIn(user.timezone);
  const [t, format, day, presets] = await Promise.all([
    getTranslations(),
    getFormatter(),
    loadDay(client.id, today, [...FALLBACK_SLOTS]),
    db.drinkPreset.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Hydration.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Hydration.lead")}</p>
        </div>
        <AddDrinkDialog date={today} />
      </header>
      <HydrationCard clientId={client.id} date={today} target={day.target?.fluidMl ?? null} variant="page" />
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
