"use client";

import { Line, LineChart, Tooltip, YAxis } from "recharts";

type Point = { value: number; tip: string };

// A small trend: the line in the muted ink, the latest point in the accent; hovering a point shows its tip. Screen readers
// get the label, which carries the values.
export function Sparkline({ points, domain, label }: { points: Point[]; domain: [number, number]; label: string }) {
  const last = points.length - 1;
  return (
    <div role="img" aria-label={label} className="h-10 w-28 flex-none">
      <LineChart width={112} height={40} data={points} margin={{ top: 5, right: 5, bottom: 5, left: 5 }} accessibilityLayer={false}>
        <YAxis hide domain={domain} />
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={({ active, payload }) =>
            active && payload?.[0] ? <span className="rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm">{(payload[0].payload as Point).tip}</span> : null
          }
        />
        <Line
          dataKey="value"
          stroke="var(--color-muted-foreground)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={({ index, cx, cy }) => <circle key={index} cx={cx} cy={cy} r={index === last ? 4 : 0} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={2} />}
          activeDot={{ r: 4, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
        />
      </LineChart>
    </div>
  );
}
