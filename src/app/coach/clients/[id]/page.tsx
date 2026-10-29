import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { setCheckInWeekday } from "@/app/app/check-in/actions";
import { Pill } from "@/components/pill";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type CheckInAnswers, currentCheckIn } from "@/lib/check-ins";
import { Sparkline } from "@/components/sparkline";
import { nutritionDays } from "@/lib/adherence";
import { daysUntilToday, weeklyNutrition, weekStarts } from "@/lib/progress";
import { requireCoachOf } from "@/lib/auth";
import { ageOn, localOf, todayIn } from "@/lib/dates";
import { CallDialog } from "./calls/call-dialog";
import { db } from "@/lib/db";
import { latestWeighIn } from "@/lib/body-comp";
import { latestWeight, targetFor } from "@/lib/nutrition";
import { targetSummary } from "@/lib/target-summary";
import { type Allergen, DAY_TYPES, type DietType, type Goal, type Sex, type SportLevel, type TrackingMode } from "@/lib/enums";

// Overview: what the client works toward, the current targets, key trends, the check-in and what to know before planning
// (profile summary, allergies first in mind).
export default async function ClientOverview({ params }: PageProps<"/coach/clients/[id]">) {
  const { coach, client } = await requireCoachOf((await params).id);
  const [t, format, user, targetRows, lastCheckIn, weighIn, calls] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { email: true, timezone: true } }),
    db.nutritionTarget.findMany({ where: { clientId: client.id } }),
    db.checkIn.findFirst({ where: { clientId: client.id }, orderBy: { dueDate: "desc" }, select: { id: true, dueDate: true } }),
    latestWeighIn(client.id),
    db.call.findMany({ where: { clientId: client.id, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
  ]);
  const today = todayIn(user.timezone);
  // Key trends: the last 4 weeks' adherence, the last 4 check-ins' average score, the last 4 weigh-ins.
  const starts = weekStarts(today, 4);
  const [checkIn, days, recentCheckIns, weighIns] = await Promise.all([
    currentCheckIn(client, user.timezone),
    nutritionDays([{ id: client.id, trackingMode: client.trackingMode, timezone: user.timezone }], new Map([[client.id, daysUntilToday(starts[0], today)]])),
    db.checkIn.findMany({ where: { clientId: client.id }, orderBy: { dueDate: "desc" }, take: 4, select: { dueDate: true, answers: true } }),
    db.bodyComp.findMany({ where: { clientId: client.id, weightKg: { not: null } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 4, select: { date: true, weightKg: true } }),
  ]);
  const one = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const short = (date: string) => format.dateTime(new Date(date), { day: "numeric", month: "numeric", timeZone: "UTC" });
  const trends = [
    {
      key: "adherence",
      domain: [0, 100] as [number, number],
      points: weeklyNutrition(days.get(client.id)!, starts).flatMap((w) => (w.adherence == null ? [] : [{ value: w.adherence, tip: `${short(w.start)}: ${format.number(w.adherence / 100, { style: "percent" })}` }])),
      show: (v: number) => format.number(v / 100, { style: "percent" }),
    },
    {
      key: "checkIn",
      domain: [1, 10] as [number, number],
      points: recentCheckIns.toReversed().map((c) => {
        const scores = Object.values(c.answers as CheckInAnswers).map((a) => a.score);
        const value = Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10) / 10;
        return { value, tip: `${short(c.dueDate)}: ${one(value)}` };
      }),
      show: (v: number) => t("CheckIn.outOf", { score: one(v) }),
    },
    {
      key: "weight",
      domain: undefined,
      points: weighIns.toReversed().map((w) => ({ value: w.weightKg!, tip: `${short(w.date)}: ${one(w.weightKg!)} kg` })),
      show: (v: number) => t("ClientDashboard.kg", { value: one(v) }),
    },
  ] as const;
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
    [t("ClientDashboard.weight"), kg(latestWeight(client.weightKg, weighIn))],
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

      <section aria-labelledby="overview-trends" className="rounded-lg border bg-card p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="overview-trends" className="text-base font-semibold">
            {t("ClientDashboard.trends")}
          </h2>
          <Link href={`/coach/clients/${client.id}/progress`} className="text-sm font-medium text-primary-ink hover:underline">
            {t("ClientDashboard.allProgress")}
          </Link>
        </div>
        <dl className="mt-4 grid gap-6 sm:grid-cols-3">
          {trends.map(({ key, domain, points, show }) => {
            const values = points.map((p) => p.value);
            return (
              <div key={key} className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">{t(`ClientDashboard.trend.${key}`)}</dt>
                  <dd className={points.length ? "text-base font-medium tabular-nums" : "text-muted-foreground"}>{points.length ? show(values.at(-1)!) : "—"}</dd>
                </div>
                {points.length > 1 && (
                  <Sparkline points={points} domain={domain ?? [Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)]} label={t("ClientDashboard.trendLabel", { trend: t(`ClientDashboard.trend.${key}`), values: points.map((p) => p.tip).join(", ") })} />
                )}
              </div>
            );
          })}
        </dl>
      </section>

      {calls.length > 0 && (
        <section aria-labelledby="overview-calls" className="rounded-lg border bg-card px-6 py-4">
          <h2 id="overview-calls" className="text-base font-semibold">
            {t("Calls.upcoming")}
          </h2>
          <ul className="mt-2">
            {calls.map((call) => (
              <li key={call.id} className="flex items-center justify-between gap-4 border-t border-rule py-2 text-sm first:border-0">
                <span>
                  <span className="font-medium tabular-nums">{format.dateTime(call.startsAt, { weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="text-muted-foreground"> · {[t("Training.minutes", { count: call.durationMin }), call.agenda].filter(Boolean).join(" · ")}</span>
                </span>
                <CallDialog
                  clientId={client.id}
                  call={call}
                  startsAt={localOf(call.startsAt, coach.timezone)}
                  trigger={
                    <Button variant="ghost" className="-mr-2.5 h-10 px-2.5 sm:h-8" aria-label={t("Calls.editFor", { time: format.dateTime(call.startsAt, { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }) })}>
                      {t("Calls.edit")}
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The weekly check-in: its day (the coach sets it) and where the current period stands. */}
      <section aria-labelledby="overview-check-in" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="overview-check-in" className="text-base font-semibold">
            {t("ClientDashboard.checkIn")}
          </h2>
          {checkIn.status !== "ok" ? <Pill tone={checkIn.status === "overdue" ? "warning" : "accent"}>{t(`Clients.checkIn.${checkIn.status}`)}</Pill> : <span className="text-sm text-muted-foreground">{t("Clients.checkIn.ok")}</span>}
          <span className="text-sm text-muted-foreground">
            {lastCheckIn
              ? t.rich("ClientDashboard.lastCheckIn", {
                  date: day(lastCheckIn.dueDate)!,
                  link: (chunks) => (
                    <Link href={`/coach/check-ins/${lastCheckIn.id}`} className="font-medium text-primary-ink hover:underline">
                      {chunks}
                    </Link>
                  ),
                })
              : t("ClientDashboard.noCheckIn")}
          </span>
        </div>
        <form action={setCheckInWeekday} className="flex items-center gap-2">
          <input type="hidden" name="clientId" value={client.id} />
          <label htmlFor="check-in-weekday" className="text-sm text-muted-foreground">
            {t("ClientDashboard.checkInDay")}
          </label>
          <NativeSelect id="check-in-weekday" name="weekday" defaultValue={client.checkInWeekday} className="[&_select]:h-10 sm:[&_select]:h-8">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <NativeSelectOption key={d} value={d}>
                {/* 2024-01-01 was a Monday. */}
                {format.dateTime(new Date(Date.UTC(2024, 0, d)), { weekday: "long", timeZone: "UTC" })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" className="h-10 sm:h-8">
            {t("ClientDashboard.checkInSave")}
          </Button>
        </form>
      </section>

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
