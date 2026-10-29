import type { BodyComp } from "@/generated/prisma/client";
import { db } from "./db";
import { BODY_FIELDS, type BodyField } from "./enums";

type Values = Record<BodyField, number | null>;

const round1 = (value: number) => Math.round(value * 10) / 10;

// Lean mass as entered, else weight × (1 − body fat %).
export const leanMass = (entry: Pick<Values, "weightKg" | "bodyFatPct" | "leanMassKg">) =>
  entry.leanMassKg ?? (entry.weightKg != null && entry.bodyFatPct != null ? round1(entry.weightKg * (1 - entry.bodyFatPct / 100)) : null);

// Entries oldest first → each with its values (lean mass filled in) and the change of each value against the latest
// earlier entry that has it (a tape-only entry between two weigh-ins doesn't break the weight's Δ).
export function withDeltas<T extends Values>(entries: T[]) {
  const last: Partial<Values> = {};
  return entries.map((entry) => {
    const values: Values = { ...entry, leanMassKg: leanMass(entry) };
    const delta = Object.fromEntries(BODY_FIELDS.map((f) => [f, values[f] != null && last[f] != null ? round1(values[f] - last[f]) : null])) as Values;
    for (const f of BODY_FIELDS) if (values[f] != null) last[f] = values[f];
    return { entry, values, delta };
  });
}

// The latest weigh-in (on or before `until`, a YYYY-MM-DD), for latestWeight().
export const latestWeighIn = (clientId: string, until?: string): Promise<Pick<BodyComp, "weightKg"> | null> =>
  db.bodyComp.findFirst({ where: { clientId, weightKg: { not: null }, date: { lte: until } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { weightKg: true } });
