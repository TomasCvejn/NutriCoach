import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { LOCALES, TIMEZONES } from "@/i18n/locales";
import { requireUser } from "@/lib/auth";
import { saveSettings } from "./actions";

// The signed-in user's own settings. Also the coach's page (/coach/settings re-exports it); the area layout has
// already checked the role. Each section is a row: its title and what it does beside a panel with one Save.
export default async function SettingsPage() {
  const user = await requireUser();
  const [t, format, now] = await Promise.all([getTranslations(), getFormatter(), getNow()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("Settings.title")}</h1>
      <section aria-labelledby="region" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div className="lg:pt-6">
          <h2 id="region" className="text-base font-semibold">
            {t("Settings.region.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("Settings.region.text")}</p>
        </div>
        <form action={saveSettings} className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="locale">{t("Language.label")}</Label>
            <NativeSelect id="locale" name="locale" defaultValue={user.locale} className="w-full">
              {LOCALES.map((l) => (
                <NativeSelectOption key={l} value={l}>
                  {t(`Language.${l}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone">{t("Settings.region.timezone")}</Label>
            <NativeSelect id="timezone" name="timezone" defaultValue={user.timezone} aria-describedby="timezone-note" className="w-full">
              {TIMEZONES.map((zone) => (
                <NativeSelectOption key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {/* What the zone produces: the user's own day and time right now. */}
            <p id="timezone-note" className="text-xs text-muted-foreground">
              {t("Settings.region.now", { time: format.dateTime(now, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) })}
            </p>
          </div>
          <Button type="submit" className="h-10 self-end px-4 sm:h-8">
            {t("Settings.save")}
          </Button>
        </form>
      </section>
    </div>
  );
}
