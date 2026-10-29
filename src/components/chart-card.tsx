"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

// One point: its x label (a formatted date), the value (null = no data, a gap) and the value as shown (formatted on the
// server with its unit, the target too when there is one). `target` draws a dashed reference line.
export type ChartPoint = { label: string; value: number | null; display: string; target?: number | null };

// A line chart in a card: the title names the series, a dashed target line with a two-item legend when the points carry
// targets, recessive grid and axes, a crosshair tooltip, and a toggle to the same points as a table.
export function ChartCard({ title, points, domain, legend }: { title: string; points: ChartPoint[]; domain?: [number, number]; legend?: { value: string; target: string } }) {
  const t = useTranslations("Charts");
  const id = useId();
  const [table, setTable] = useState(false);
  const known = points.filter((p) => p.value != null);
  const values = points.flatMap((p) => [p.value, p.target ?? null]).filter((v) => v != null);
  // Headroom: a fifth of the spread, at least 5 % of the value, so 20 kcal on 2 200 doesn't look like a swing.
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2, Math.max(...values.map(Math.abs)) * 0.05);
  const targets = points.some((p) => p.target != null);
  const dot = { fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 };

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 id={`${id}-title`} className="text-sm font-semibold">
          {title}
        </h3>
        {known.length > 0 && (
          <Button variant="outline" aria-pressed={table} onClick={() => setTable(!table)} className="h-10 px-3 sm:h-8">
            {t(table ? "showChart" : "showTable")}
          </Button>
        )}
      </div>
      {known.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : table ? (
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">{title}</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-t border-rule first:border-0">
                <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                  {p.label}
                </th>
                <td className="py-2 text-right">{p.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {targets && legend && (
            <p aria-hidden className="-mt-1 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-primary" />
                {legend.value}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
                {legend.target}
              </span>
            </p>
          )}
          <div role="img" aria-label={t("label", { title, from: points[0].label, to: points.at(-1)!.label, latest: known.at(-1)!.display })} className="h-48">
            <ResponsiveContainer initialDimension={{ width: 480, height: 192 }}>
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke="var(--color-rule)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} minTickGap={16} padding={{ left: 16, right: 16 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  domain={domain ?? [Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "3 3" }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const point = active && (payload?.[0]?.payload as ChartPoint | undefined);
                    return point ? (
                      <span className="flex flex-col rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                        <span className="text-muted-foreground">{point.label}</span>
                        <span className="font-medium tabular-nums">{point.display}</span>
                      </span>
                    ) : null;
                  }}
                />
                {targets && <Line dataKey="target" stroke="var(--color-muted-foreground)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />}
                <Line dataKey="value" stroke="var(--color-primary)" strokeWidth={2} isAnimationActive={false} dot={{ r: 4, ...dot }} activeDot={{ r: 5, ...dot }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
