import { getFormatter, getTranslations } from "next-intl/server";
import { ChartCard } from "@/components/chart-card";
import { withDeltas } from "@/lib/body-comp";
import { db } from "@/lib/db";
import { BODY_FIELDS, type BodyCompMethod, type BodyField } from "@/lib/enums";
import { BodyCompDialog } from "./body-comp-dialog";

const UNITS: Record<BodyField, string> = { weightKg: "kilogram", bodyFatPct: "percent", leanMassKg: "kilogram", waistCm: "centimeter", hipsCm: "centimeter", chestCm: "centimeter", thighCm: "centimeter", armCm: "centimeter" };

// Body composition on the client's Progress page and the coach's Progress tab (both add and edit): weight and body-fat
// charts, each with its table, then every entry with its change against the previous one, newest first.
export async function BodyComposition({ clientId, today }: { clientId: string; today: string }) {
  const [t, format, entries] = await Promise.all([
    getTranslations("BodyComp"),
    getFormatter(),
    db.bodyComp.findMany({ where: { clientId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
  ]);
  const rows = withDeltas(entries);
  // A calendar day: formatted at UTC midnight so no timezone can move it.
  const day = (date: string, short = false) => format.dateTime(new Date(date), short ? { day: "numeric", month: "numeric", timeZone: "UTC" } : { dateStyle: "medium", timeZone: "UTC" });
  const value = (field: BodyField, v: number) => format.number(v, { style: "unit", unit: UNITS[field], maximumFractionDigits: 1 });
  const series = (field: BodyField) => rows.flatMap((r) => (r.values[field] == null ? [] : [{ label: day(r.entry.date, true), value: r.values[field], display: value(field, r.values[field]) }]));
  const charts = (["weightKg", "bodyFatPct"] as const).map((field) => ({ field, points: series(field) })).filter((c) => c.points.length > 0);
  // Only the measurements this client has.
  const fields = BODY_FIELDS.filter((f) => rows.some((r) => r.values[f] != null));
  const notes = entries.some((e) => e.note);

  return (
    <section aria-labelledby="body-comp" id="body" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="body-comp" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <BodyCompDialog clientId={clientId} today={today} />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {charts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {charts.map((c) => (
                <ChartCard key={c.field} title={t(`charts.${c.field}`)} points={c.points} />
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">{t("entries")}</caption>
              <thead>
                <tr className="border-b border-rule text-left text-xs text-muted-foreground">
                  <th scope="col" className="sticky left-0 bg-card px-5 py-3 font-medium">
                    {t("fields.date")}
                  </th>
                  {fields.map((f) => (
                    <th key={f} scope="col" className="px-3 py-3 text-right font-medium whitespace-nowrap">
                      {t(`columns.${f}`)}
                    </th>
                  ))}
                  {notes && (
                    <th scope="col" className="px-3 py-3 font-medium">
                      {t("fields.note")}
                    </th>
                  )}
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">{t("edit")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.toReversed().map(({ entry, values, delta }) => (
                  <tr key={entry.id} className="border-b border-rule align-top last:border-0">
                    <th scope="row" className="sticky left-0 bg-card px-5 py-3 text-left font-normal whitespace-nowrap">
                      <span className="block font-medium">{day(entry.date)}</span>
                      <span className="text-xs text-muted-foreground">{t(`methods.${entry.method as BodyCompMethod}`)}</span>
                    </th>
                    {fields.map((f) => (
                      <td key={f} className="px-3 py-3 text-right whitespace-nowrap">
                        {values[f] == null ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <>
                            <span className="block">{format.number(values[f], { maximumFractionDigits: 1 })}</span>
                            {delta[f] != null && (
                              <span className="text-xs text-muted-foreground">
                                <span className="sr-only">{t("change")} </span>
                                {format.number(delta[f], { maximumFractionDigits: 1, signDisplay: "exceptZero" })}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                    {notes && <td className="min-w-48 px-3 py-3 text-muted-foreground">{entry.note}</td>}
                    <td className="px-5 py-2 text-right">
                      <BodyCompDialog clientId={clientId} today={today} entry={entry} label={t("editFrom", { date: day(entry.date) })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
