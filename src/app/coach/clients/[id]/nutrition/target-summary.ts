import type { TrackingMode } from "@/lib/enums";
import { modeFields, type TargetValues } from "@/lib/nutrition";

// A target row in one line for the current mode ("2 230 kcal · P 150 g · … · 2 450 ml"); null when it sets nothing.
export function targetSummary(row: Partial<TargetValues>, mode: TrackingMode, t: (key: string, values: { value: string }) => string, number: (value: number) => string) {
  const parts = modeFields(mode).flatMap((field) => (row[field] != null ? [t(`Targets.summary.${field}`, { value: number(row[field]) })] : []));
  return parts.length ? parts.join(" · ") : null;
}
