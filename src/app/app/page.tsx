import { getFormatter, getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { dayType } from "@/lib/nutrition";

// Client home "Today": widgets in the order of home-and-basics.md, each landing with its feature.
export default async function ClientHome() {
  const { user } = await requireClient();
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const today = todayIn(user.timezone);
  // ponytail: overrides, sessions and competitions don't exist yet, so every day is REST until their items pass them in.
  const type = dayType({});

  return (
    // Widget 1: the date and the day type, which decides the day's targets.
    <header>
      <h1 className="text-2xl font-bold tracking-tight">{t("ClientHome.title")}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {/* A calendar day: formatted at UTC midnight so no timezone can move it. */}
        <span className="first-letter:uppercase">{format.dateTime(new Date(today), { dateStyle: "full", timeZone: "UTC" })}</span>
        <span className="rounded-full bg-primary-track/60 px-2.5 py-0.5 text-xs font-medium text-primary-ink">{t(`DayTypes.${type}`)}</span>
      </p>
    </header>
  );
}
