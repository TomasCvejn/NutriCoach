import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { setFuelingOverride } from "@/app/coach/library/fueling/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TrainingSession } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Intensity, SessionType } from "@/lib/enums";
import { duringTotals, fuelingFor } from "@/lib/fueling";
import { SessionDialog } from "./session-dialog";

type Pre = { timing: string; text: string; carbs?: number | null };

// One session for the client or the coach (`override`: the coach picks the fueling template): what it is, how it went,
// and its fueling plan (training.md: "nutrition linked to each session") with the totals over its duration.
export async function SessionDetail({ session, coachId, back, override }: { session: TrainingSession; coachId: string; back: string; override: boolean }) {
  const [t, format, templates] = await Promise.all([
    getTranslations("Training"),
    getFormatter(),
    db.fuelingTemplate.findMany({ where: { coachId }, orderBy: [{ priority: "desc" }, { name: "asc" }] }),
  ]);
  const plan = fuelingFor(session, templates, session.fuelingTemplateId);
  const totals = plan && duringTotals(plan, session.durationMin);
  const n = (value: number) => format.number(value);
  // The coach's page sits under the client's header, which holds the h1.
  const Heading = override ? "h2" : "h1";
  const after = [session.rpe != null && t("rpe", { rpe: session.rpe }), session.felt != null && t("felt", { felt: session.felt })].filter(Boolean).join(" · ");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={back} className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" aria-hidden />
            {t("title")}
          </Link>
          <Heading className="text-2xl font-bold tracking-tight">
            {t(`types.${session.type as SessionType}`)}
            {session.sport && ` · ${session.sport}`}
          </Heading>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
            {[
              format.dateTime(new Date(session.date), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
              session.startTime,
              t("minutes", { count: session.durationMin }),
              t(`intensities.${session.intensity as Intensity}`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <SessionDialog clientId={session.clientId} date={session.date} session={session} back={back} trigger={<Button variant="outline" className="h-10 px-4 sm:h-8 sm:px-3">{t("edit")}</Button>} />
      </header>

      {(session.description || after || session.note) && (
        <section aria-labelledby="session-about" className="rounded-lg border bg-card p-5 text-sm">
          <h2 id="session-about" className="sr-only">
            {t("about")}
          </h2>
          {session.description && <p className="text-base whitespace-pre-line">{session.description}</p>}
          {(after || session.note) && (
            <p className={session.description ? "mt-3 border-t border-rule pt-3" : ""}>
              <span className="font-medium">{t("after")}: </span>
              {[after, session.note].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="session-fueling" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 id="session-fueling" className="text-base font-semibold">
            {t("fueling")}
          </h2>
          {plan && <p className="mt-1 text-sm text-muted-foreground">{t(session.fuelingTemplateId ? "byCoach" : "byTemplate", { name: plan.name })}</p>}
        </div>
        {!plan ? (
          <p className="text-sm text-muted-foreground">{t("noFueling")}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("phases.pre")}</h3>
              {(plan.pre as Pre[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {(plan.pre as Pre[]).map((item, i) => (
                    <li key={i}>
                      <span className="block text-muted-foreground">{item.timing}</span>
                      {item.text}
                      {item.carbs != null && <span className="tabular-nums"> · {t("carbs", { value: n(item.carbs) })}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("phases.during")}</h3>
              <dl className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["carbs", totals!.carbs, "g", plan.duringCarbsPerHour],
                    ["fluid", totals!.fluidMl, "ml", plan.duringFluidPerHour],
                    ["sodium", totals!.sodiumMg, "mg", plan.duringSodiumPerHour],
                  ] as const
                ).map(([key, total, unit, perHour]) => (
                  <div key={key} className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">{t(`during.${key}`)}</dt>
                    <dd className="text-lg font-semibold whitespace-nowrap tabular-nums">{total == null ? "—" : `${n(total)} ${unit}`}</dd>
                    {perHour != null && <dd className="text-xs text-muted-foreground tabular-nums">{t("perHour", { value: `${n(perHour)} ${unit}` })}</dd>}
                  </div>
                ))}
              </dl>
              {plan.duringText && <p className="text-sm">{plan.duringText}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("phases.post")}</h3>
              <p className="text-sm">
                {[
                  plan.postWithinMin != null && t("within", { minutes: plan.postWithinMin }),
                  plan.postProtein != null && t("protein", { value: n(plan.postProtein) }),
                  plan.postCarbs != null && t("carbs", { value: n(plan.postCarbs) }),
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {plan.postFluidText && <p className="text-sm">{plan.postFluidText}</p>}
            </div>
          </div>
        )}
        {override && (
          <form action={setFuelingOverride} className="flex flex-wrap items-end gap-2 border-t border-rule pt-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <label className="flex flex-col gap-2 text-sm font-medium">
              {t("override")}
              <NativeSelect name="templateId" defaultValue={session.fuelingTemplateId ?? ""} className="[&_select]:h-10 sm:[&_select]:h-8">
                <NativeSelectOption value="">{t("automatic")}</NativeSelectOption>
                {templates.map((template) => (
                  <NativeSelectOption key={template.id} value={template.id}>
                    {template.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <Button type="submit" variant="outline" className="h-10 sm:h-8">
              {t("overrideSave")}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
