import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/pill";
import { requireCoachOf } from "@/lib/auth";
import { ageOn, todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { latestWeight, targetFor } from "@/lib/nutrition";
import { targetSummary } from "@/lib/target-summary";
import { type Allergen, DAY_TYPES, type DietType, type Goal, type Sex, type SportLevel, type TrackingMode } from "@/lib/enums";

// Overview: what the client works toward and what to know before planning (profile summary, allergies first in mind).
// Current targets, the last check-in and key trends join when their features land.
export default async function ClientOverview({ params }: PageProps<"/coach/clients/[id]">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, format, user, targetRows] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { email: true, timezone: true } }),
    db.nutritionTarget.findMany({ where: { clientId: client.id } }),
  ]);
  const today = todayIn(user.timezone);
  const mode = client.trackingMode as TrackingMode;
  // Today's targets per day type: its own row, else the rest day's (shown as such).
  const targets = DAY_TYPES.map((dayType) => ({ dayType, own: targetFor(targetRows.filter((r) => r.dayType === dayType), today, dayType) }));
  const restTarget = targets[0].own;
  const since = targets.reduce((latest, { own }) => (own && own.effectiveFrom > latest ? own.effectiveFrom : latest), "");
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const kg = (value: number | null) => value != null && t("ClientDashboard.kg", { value: number(value) });
  // A calendar day: formatted at UTC midnight so no timezone can move it.
  const day = (date: string | null) => date && format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" });
  const allergens = client.allergens as Allergen[];
  const training = [
    client.sportLevel && t(`SportLevels.${client.sportLevel as SportLevel}`),
    client.sessionsPerWeek != null && t("ClientDashboard.sessionsPerWeek", { count: client.sessionsPerWeek }),
    client.sessionMinutes != null && t("ClientDashboard.minutes", { minutes: client.sessionMinutes }),
  ].filter(Boolean);

  // Always shown, with a dash when empty; the free-text rows only when the client wrote something.
  const rows: [string, ReactNode][] = [
    [t("ClientDashboard.age"), client.birthDate && t("ClientDashboard.years", { age: ageOn(client.birthDate, today) })],
    [t("Profile.fields.sex"), client.sex && t(`Sexes.${client.sex as Sex}`)],
    [t("ClientDashboard.height"), client.heightCm != null && t("ClientDashboard.cm", { value: client.heightCm })],
    [t("Profile.fields.dietType"), client.dietType && t(`DietTypes.${client.dietType as DietType}`)],
    [
      t("Profile.fields.allergens"),
      (allergens.length > 0 || client.allergiesNote) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {allergens.map((a) => (
            <Pill key={a} tone="warning">
              {t(`Allergens.${a}`)}
            </Pill>
          ))}
          {client.allergiesNote && <span>{client.allergiesNote}</span>}
        </span>
      ),
    ],
    [t("ClientDashboard.sport"), client.sports && [client.sports, ...training].join(" · ")],
    [t("Profile.fields.mealsPerDay"), client.mealsPerDay != null && format.number(client.mealsPerDay)],
    [t("ClientDashboard.contact"), [user.email, client.phone].filter(Boolean).join(" · ")],
    ...(
      [
        ["restrictions", client.restrictions],
        ["likedFoods", client.likedFoods],
        ["dislikedFoods", client.dislikedFoods],
        ["healthConditions", client.healthConditions],
        ["medications", client.medications],
        ["otherInfo", client.otherInfo],
      ] as const
    )
      .filter(([, value]) => value)
      .map(([field, value]): [string, ReactNode] => [t(`Profile.fields.${field}`), value]),
    ...(client.preferredTrackingMode ? [[t("Onboarding.done.tracking"), t(`TrackingModes.${client.preferredTrackingMode as TrackingMode}`)] as [string, ReactNode]] : []),
  ];

  const figures: [string, ReactNode][] = [
    [t("ClientDashboard.weight"), kg(latestWeight(client.weightKg))],
    [t("ClientDashboard.targetWeight"), kg(client.targetWeightKg)],
    [t("Profile.fields.targetDate"), day(client.targetDate)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="overview-goals" className="rounded-lg border bg-card p-6">
          <h2 id="overview-goals" className="text-base font-semibold">
            {t("Profile.sections.goals.title")}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
            <p className={`col-span-3 text-xl font-semibold ${client.primaryGoal ? "" : "text-muted-foreground"}`}>
              {client.primaryGoal ? t(`Goals.${client.primaryGoal as Goal}`) : t("ClientDashboard.noGoal")}
            </p>
            <dl className="contents">
              {figures.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`tabular-nums ${value ? "text-base font-medium" : "text-muted-foreground"}`}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          {client.successText && (
            <div className="mt-6">
              <h3 className="text-xs text-muted-foreground">{t("ClientDashboard.success")}</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{client.successText}</p>
            </div>
          )}
        </section>

        <section aria-labelledby="overview-targets" className="rounded-lg border bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="overview-targets" className="text-base font-semibold">
              {t("ClientDashboard.targets")}
            </h2>
            <Link href={`/coach/clients/${client.id}/nutrition`} className="text-sm font-medium text-primary-ink hover:underline">
              {t("ClientDashboard.editTargets")}
            </Link>
          </div>
          <dl className="mt-3 text-sm">
            {targets.map(({ dayType, own }) => {
              const summary = own && targetSummary(own, mode, t, number);
              return (
                <div key={dayType} className="grid gap-1 border-b border-rule py-2.5 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">{t(`DayTypes.${dayType}`)}</dt>
                  <dd className={summary ? "tabular-nums" : "text-muted-foreground"}>
                    {summary ?? (dayType !== "REST" && restTarget ? t("ClientDashboard.asRest") : "—")}
                  </dd>
                </div>
              );
            })}
          </dl>
          {since && <p className="mt-3 text-xs text-muted-foreground">{t("ClientDashboard.targetsSince", { date: format.dateTime(new Date(since), { dateStyle: "medium", timeZone: "UTC" }) })}</p>}
        </section>
      </div>

      <section aria-labelledby="overview-profile" className="rounded-lg border bg-card p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="overview-profile" className="text-base font-semibold">
            {t("Profile.title")}
          </h2>
          <Link href={`/coach/clients/${client.id}/profile`} className="text-sm font-medium text-primary-ink hover:underline">
            {t("ClientDashboard.editProfile")}
          </Link>
        </div>
        {/* Two balanced columns on wide screens (the browser evens them out), one on narrow ones. */}
        <dl className="mt-3 gap-x-10 text-sm lg:columns-2">
          {rows.map(([label, value]) => (
            <div key={label} className="grid break-inside-avoid gap-1 border-b border-rule py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={value ? "whitespace-pre-line" : "text-muted-foreground"}>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
