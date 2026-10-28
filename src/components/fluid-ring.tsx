// The day's fluid against its target as a thin ring, the amounts in the middle. The arc is the true ratio, capped at a
// full circle; past the target the arc turns to the hue's dark ink (more fluid is fine, so no alarm).
export function FluidRing({ value, target, label, valueText, targetText, size = 144 }: { value: number; target: number | null; label: string; valueText: string; targetText: string; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target ? Math.min(value / target, 1) : 0;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={target ?? undefined} aria-valuenow={value} aria-valuetext={`${valueText} ${targetText}`.trim()} className="relative flex-none" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-primary-track/60" />
        {ratio > 0 && (
          <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          className={target && value > target ? "stroke-primary-ink" : "stroke-primary"}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-semibold tabular-nums">{valueText}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{targetText}</span>
      </span>
    </div>
  );
}
