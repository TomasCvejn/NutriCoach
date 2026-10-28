// A value against its target (nutrition.md "progress bars ... over-target distinct"): the fill is the true ratio, capped at
// the track's end. Over the target the fill turns to the hue's dark ink; `alarm` (e.g. kcal past the ±10 % window) turns it
// to the negative colour and says the overrun in words. Colour says good or bad: more protein than the target is fine.
export function TargetBar({ label, value, target, text, alarm }: { label: string; value: number; target: number; text: string; alarm?: string }) {
  const over = value > target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{text}</span>
      </div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value} aria-valuetext={text} className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary-track/60">
        <div
          className={`h-full rounded-full ${alarm ? "bg-destructive" : over ? "bg-primary-ink" : "bg-primary"}`}
          style={{ width: `${target > 0 ? Math.min(value / target, 1) * 100 : 0}%` }}
        />
      </div>
      {alarm && <p className="mt-1 text-xs text-destructive-ink">{alarm}</p>}
    </div>
  );
}
