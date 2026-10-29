import { getFormatter, getNow, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { LOCALES, TIMEZONES } from "@/i18n/locales";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_NOTIFICATIONS } from "@/lib/enums";
import { deleteAccount, saveNotificationSettings, saveSettings, saveWelcomeText } from "./actions";

// The signed-in user's own settings. Also the coach's page (/coach/settings re-exports it); the area layout has
// already checked the role. Each section is a row: its title and what it does beside a panel with one Save.
export default async function SettingsPage() {
  const user = await requireUser();
  const [t, format, now, coach, { mutedNotifications }] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getNow(),
    user.role === "COACH" ? db.user.findUniqueOrThrow({ where: { id: user.id }, select: { welcomeText: true } }) : null,
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { mutedNotifications: true } }),
  ]);
  const types = ROLE_NOTIFICATIONS[user.role as keyof typeof ROLE_NOTIFICATIONS];

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
          {/* A Save per panel, outlined like the profile's: the hue stays on the data. */}
          <Button type="submit" variant="outline" className="h-10 self-end px-4 sm:h-8">
            {t("Settings.save")}
          </Button>
        </form>
      </section>
      <section aria-labelledby="account" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div className="lg:pt-6">
          <h2 id="account" className="text-base font-semibold">
            {t("Settings.account.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("Settings.account.text")}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <dl className="text-sm">
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-muted-foreground">{t("Settings.account.name")}</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-rule py-1.5">
              <dt className="text-muted-foreground">{t("Settings.account.email")}</dt>
              <dd className="break-all">{user.email}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t("Settings.account.google")}</p>
          <Link href="/privacy" className="self-start text-sm font-medium text-primary-ink hover:underline">
            {t("Privacy.link")}
          </Link>
        </div>
      </section>
      <section aria-labelledby="notifications" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div className="lg:pt-6">
          <h2 id="notifications" className="text-base font-semibold">
            {t("Settings.notifications.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("Settings.notifications.text")}</p>
        </div>
        <form action={saveNotificationSettings} className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <fieldset className="flex flex-col">
            <legend className="sr-only">{t("Settings.notifications.title")}</legend>
            {types.map((type) => (
              <label key={type} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-rule py-2 text-sm first-of-type:border-0">
                <input type="checkbox" name="on" value={type} defaultChecked={!(mutedNotifications as string[]).includes(type)} className="size-5 flex-none accent-primary" />
                {t(`Settings.notifications.types.${type}`)}
              </label>
            ))}
          </fieldset>
          <Button type="submit" variant="outline" className="h-10 self-end px-4 sm:h-8">
            {t("Settings.save")}
          </Button>
        </form>
      </section>
      {user.role === "CLIENT" && (
        <section aria-labelledby="data" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="lg:pt-6">
            <h2 id="data" className="text-base font-semibold">
              {t("Settings.data.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Settings.data.text")}</p>
          </div>
          <div className="flex flex-col gap-6 rounded-lg border bg-card p-6">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("Settings.data.exportHint")}</p>
              <a href="/api/export" download className={buttonVariants({ variant: "outline", className: "h-10 self-start px-4 sm:h-8" })}>
                {t("Settings.data.export")}
              </a>
            </div>
            {/* The browser refuses anything but the exact word (pattern); the action checks it again. */}
            <form action={deleteAccount} className="flex flex-col gap-3 border-t border-rule pt-6">
              <h3 className="text-sm font-semibold">{t("Settings.data.deleteTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("Settings.data.deleteText")}</p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">{t("Settings.data.confirm", { word: t("Settings.data.word") })}</Label>
                <Input id="confirm" name="confirm" required pattern={t("Settings.data.word")} autoComplete="off" className="h-10 sm:h-8" />
              </div>
              <Button type="submit" variant="destructive" className="h-10 self-end px-4 sm:h-8">
                {t("Settings.data.delete")}
              </Button>
            </form>
          </div>
        </section>
      )}
      {coach && (
        <section aria-labelledby="welcome" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="lg:pt-6">
            <h2 id="welcome" className="text-base font-semibold">
              {t("Settings.welcome.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Settings.welcome.text")}</p>
          </div>
          <form action={saveWelcomeText} className="flex flex-col gap-4 rounded-lg border bg-card p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="welcomeText">{t("Settings.welcome.label")}</Label>
              {/* The placeholder is the preview: what clients read while the field is empty. */}
              <Textarea
                id="welcomeText"
                name="welcomeText"
                defaultValue={coach.welcomeText ?? ""}
                placeholder={t("Onboarding.welcome.defaultText")}
                maxLength={2000}
                rows={5}
                aria-describedby="welcomeText-note"
              />
              <p id="welcomeText-note" className="text-xs text-muted-foreground">
                {t("Settings.welcome.hint")}
              </p>
            </div>
            <Button type="submit" variant="outline" className="h-10 self-end px-4 sm:h-8">
              {t("Settings.save")}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
