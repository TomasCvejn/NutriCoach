"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DAY_TYPES, type DayType, type TrackingMode } from "@/lib/enums";
import {
  ACTIVITY_FACTORS,
  kcalFromMacros,
  kcalMismatch,
  modeFields,
  perKg,
  suggestFluid,
  suggestTargets,
  TARGET_VALUE_FIELDS,
  type TargetField,
  type TargetValues,
} from "@/lib/nutrition";
import { saveTargets } from "./actions";

type Props = {
  clientId: string;
  mode: TrackingMode;
  today: string;
  weightKg: number | null;
  profile: Parameters<typeof suggestTargets>[0];
  current: Record<DayType, Partial<TargetValues> | null>; // each day type's own target in force today
};
type Values = Record<DayType, Record<TargetField, string>>;

const MACROS = ["protein", "carbs", "fat"] as const;
const STEP: Partial<Record<TargetField, number>> = { palms: 0.5, hands: 0.5, fists: 0.5, thumbs: 0.5, fluidMl: 50 };

// One form for the three day types and one effective-from day, so a save is one change (one history row, one
// notification). Training and competition days left empty use the rest day's targets.
export function TargetsEditor({ clientId, mode, today, weightKg, profile, current }: Props) {
  const t = useTranslations("Targets");
  const dayTypes = useTranslations("DayTypes");
  const format = useFormatter();
  const fields = modeFields(mode);
  const fromServer = () =>
    Object.fromEntries(DAY_TYPES.map((d) => [d, Object.fromEntries(TARGET_VALUE_FIELDS.map((f) => [f, current[d]?.[f]?.toString() ?? ""]))])) as Values;
  const [values, setValues] = useState<Values>(fromServer);
  // Targets changed on the server (a save, a copied plan): show them instead of what was typed before.
  const [shown, setShown] = useState(JSON.stringify(current));
  if (shown !== JSON.stringify(current)) {
    setShown(JSON.stringify(current));
    setValues(fromServer());
  }
  const [factor, setFactor] = useState<(typeof ACTIVITY_FACTORS)[number]>(1.55);
  const [state, save, pending] = useActionState(saveTargets, null);
  const [edited, setEdited] = useState(false); // "Saved" shows until the next change
  const invalid = (key: string) => Boolean(state && "invalid" in state && state.invalid.includes(key));

  const update = (changes: Partial<Values>) => {
    setValues((prev) => ({ ...prev, ...changes }));
    setEdited(true);
  };
  const set = (dayType: DayType, field: TargetField, value: string) => update({ [dayType]: { ...values[dayType], [field]: value } });
  const n = (value: string) => (value === "" ? 0 : Number(value));

  const suggestion = suggestTargets(profile, weightKg, today, factor);
  const fluid = suggestFluid(weightKg);
  const canSuggest = mode === "CALORIES" ? Boolean(suggestion && fluid) : Boolean(fluid);
  const suggest = () => {
    const numbers = mode === "CALORIES" && suggestion ? suggestion : {};
    const filled = Object.fromEntries(Object.entries({ ...numbers, fluidMl: fluid }).map(([f, v]) => [f, String(v)]));
    update({ REST: { ...values.REST, ...filled } });
  };
  const copyRest = () => {
    const rest = Object.fromEntries(fields.map((f) => [f, values.REST[f]]));
    update({ TRAINING: { ...values.TRAINING, ...rest }, COMPETITION: { ...values.COMPETITION, ...rest } });
  };

  return (
    <form
      action={(form) => {
        setEdited(false);
        save(form);
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="clientId" value={clientId} />
      {/* The day, the rest-day helpers (suggest, copy to the other day types), then Save at the far right. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
          <Field id="targets-from" label={t("effectiveFrom")} error={invalid("effectiveFrom") ? t("invalid") : undefined}>
            <Input
              id="targets-from"
              type="date"
              name="effectiveFrom"
              required
              defaultValue={today}
              onInput={() => setEdited(true)}
              aria-invalid={invalid("effectiveFrom")}
              aria-describedby="targets-from-note"
              className="h-10 w-44"
            />
          </Field>
          {mode === "CALORIES" && (
            <Field id="targets-factor" label={t("activity")} className="sm:ml-3">
              <NativeSelect id="targets-factor" value={factor} onChange={(e) => setFactor(Number(e.target.value) as (typeof ACTIVITY_FACTORS)[number])} className="[&_select]:h-10">
                {ACTIVITY_FACTORS.map((f, i) => (
                  <NativeSelectOption key={f} value={f}>
                    {t("factor", { level: t(`factors.${i}`), factor: format.number(f) })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Button type="button" variant="outline" disabled={!canSuggest} onClick={suggest} aria-describedby={canSuggest ? undefined : "targets-suggest-note"} className="h-10 px-3">
            {t("suggest")}
          </Button>
          <Button type="button" variant="ghost" onClick={copyRest} className="h-10 px-3">
            {t("copy")}
          </Button>
          <div className="flex items-center gap-3 lg:ml-auto">
            <p role="status" className={invalid("empty") ? "text-sm text-destructive-ink" : "text-sm text-muted-foreground"}>
              {invalid("empty") ? t("empty") : state && "saved" in state && !edited && !pending && t("saved")}
            </p>
            <Button type="submit" disabled={pending} className="h-10 px-4">
              {t("save")}
            </Button>
          </div>
        </div>
        {!canSuggest && (
          <p id="targets-suggest-note" className="text-xs text-muted-foreground">
            {t(mode === "CALORIES" ? "suggestMissing" : "suggestMissingWeight")}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {DAY_TYPES.map((dayType) => {
          const v = values[dayType];
          const macros = { protein: n(v.protein), carbs: n(v.carbs), fat: n(v.fat) };
          const anyMacro = MACROS.some((m) => v[m] !== "");
          const mismatch = v.kcal !== "" && kcalMismatch(n(v.kcal), macros);
          return (
            <section key={dayType} aria-labelledby={`targets-${dayType}`} className="rounded-lg border bg-card p-5">
              <h3 id={`targets-${dayType}`} className="text-base font-semibold">
                {dayTypes(dayType)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(dayType === "REST" ? "restText" : "fallbackText")}</p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {fields.map((field) => {
                  const id = `targets-${dayType}-${field}`;
                  const ratio = (MACROS as readonly string[]).includes(field) && v[field] !== "" ? perKg(n(v[field]), weightKg) : null;
                  return (
                    <Field
                      key={field}
                      id={id}
                      label={t(`fields.${field}`)}
                      error={invalid(`${dayType}.${field}`) ? t("invalid") : undefined}
                      hint={ratio != null ? t("perKg", { value: format.number(ratio, { maximumFractionDigits: 1 }) }) : undefined}
                      className={field === "kcal" || field === "fluidMl" ? "col-span-2" : undefined}
                    >
                      <Input
                        id={id}
                        name={`${dayType}.${field}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={STEP[field] ?? 1}
                        value={v[field]}
                        // An empty training / competition field shows the rest day's value it falls back to.
                        placeholder={dayType === "REST" ? undefined : values.REST[field]}
                        onChange={(e) => set(dayType, field, e.target.value)}
                        aria-invalid={invalid(`${dayType}.${field}`)}
                        aria-describedby={`${id}-note`}
                        className="h-10 tabular-nums"
                      />
                    </Field>
                  );
                })}
                {mode === "CALORIES" && anyMacro && (
                  <p className={`col-span-2 text-sm tabular-nums ${mismatch ? "text-warning" : "text-muted-foreground"}`}>
                    {t("fromMacros", { kcal: format.number(kcalFromMacros(macros)) })}
                    {mismatch && ` · ${t("mismatch")}`}
                  </p>
                )}
              </div>

            </section>
          );
        })}
      </div>
    </form>
  );
}
