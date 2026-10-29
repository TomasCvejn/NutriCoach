"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

// One point: its x label (a formatted date), the value and the value as shown (formatted on the server with its unit).
export type ChartPoint = { label: string; value: number; display: string };

// A single-series line chart in a card: the title names the series (no legend), recessive grid and axes, a crosshair
// tooltip, and a toggle to the same points as a table.
export function ChartCard({ title, points }: { title: string; points: ChartPoint[] }) {
  const t = useTranslations("Charts");
  const id = useId();
  const [table, setTable] = useState(false);
  const values = points.map((p) => p.value);
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2);

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 id={`${id}-title`} className="text-sm font-semibold">
          {title}
        </h3>
        <Button variant="outline" aria-pressed={table} onClick={() => setTable(!table)} className="h-10 px-3 sm:h-8">
          {t(table ? "showChart" : "showTable")}
        </Button>
      </div>
      {table ? (
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
        <div role="img" aria-label={t("label", { title, from: points[0].label, to: points.at(-1)!.label, latest: points.at(-1)!.display })} className="h-48">
          <ResponsiveContainer initialDimension={{ width: 480, height: 192 }}>
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="var(--color-rule)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} minTickGap={16} padding={{ left: 16, right: 16 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]}
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
              <Line
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
