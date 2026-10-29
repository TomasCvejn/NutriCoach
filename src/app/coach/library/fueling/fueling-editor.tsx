"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useActionState, useId, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FuelingTemplate } from "@/generated/prisma/client";
import { INTENSITIES, SESSION_TYPES } from "@/lib/enums";
import { keepValues } from "@/lib/forms";
import { deleteFuelingTemplate, saveFuelingTemplate } from "./actions";

type Pre = { timing: string; text: string; carbs?: number | null };

// A fueling template: when it applies (all conditions), then the three phases. Pre-training is a list of rows.
export function FuelingEditor({ template }: { template?: FuelingTemplate }) {
  const t = useTranslations("Fueling");
  const tt = useTranslations("Training");
  const id = useId();
  const [state, save, pending] = useActionState(saveFuelingTemplate, null);
  const [rows, setRows] = useState(() => ((template?.pre as Pre[] | undefined) ?? []).map((row, key) => ({ ...row, key })));
  const [next, setNext] = useState(rows.length);
  const invalid = (field: string) => Boolean(state?.invalid.includes(field));
  const number = (name: keyof FuelingTemplate, unit?: string) => (
    <Field key={name} id={`${id}-${name}`} label={t(`fields.${name}`)} hint={unit} error={invalid(name) ? t("invalid") : undefined}>
      <Input id={`${id}-${name}`} name={name} type="number" inputMode="numeric" min={0} defaultValue={(template?.[name] as number | null | undefined) ?? ""} aria-describedby={`${id}-${name}-note`} className="h-10 tabular-nums" />
    </Field>
  );
  const textField = (name: "duringText" | "postFluidText") => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} className="sm:col-span-full">
      <Input id={`${id}-${name}`} name={name} maxLength={300} defaultValue={template?.[name] ?? ""} className="h-10" />
    </Field>
  );
  const group = (key: string, children: ReactNode) => (
    <fieldset className="rounded-lg border bg-card p-5">
      <legend className="float-left text-base font-semibold">{t(`groups.${key}`)}</legend>
      <div className="clear-both grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <form onSubmit={keepValues(save)} className="flex flex-col gap-6">
        {template && <input type="hidden" name="id" value={template.id} />}
        <Field id={`${id}-name`} label={t("fields.name")} error={invalid("name") ? t("invalidName") : undefined} className="max-w-md">
          <Input id={`${id}-name`} name="name" required maxLength={100} defaultValue={template?.name ?? ""} aria-describedby={`${id}-name-note`} className="h-10" />
        </Field>

        {group(
          "rule",
          <>
            <div role="group" aria-label={t("fields.sessionTypes")} className="flex flex-col gap-2 sm:col-span-full">
              <span className="text-sm font-medium">{t("fields.sessionTypes")}</span>
              <div className="flex flex-wrap gap-2">
                {SESSION_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-ink has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:h-8"
                  >
                    <input type="checkbox" name="sessionTypes" value={type} defaultChecked={(template?.sessionTypes as string[] | undefined)?.includes(type)} className="sr-only" />
                    {tt(`types.${type}`)}
                  </label>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{t("anyType")}</span>
            </div>
            {number("minDurationMin", "min")}
            {number("maxDurationMin", "min")}
            <Field id={`${id}-minIntensity`} label={t("fields.minIntensity")}>
              <NativeSelect id={`${id}-minIntensity`} name="minIntensity" defaultValue={template?.minIntensity ?? ""} className="w-full [&_select]:h-10">
                <NativeSelectOption value="">{t("anyIntensity")}</NativeSelectOption>
                {INTENSITIES.map((intensity) => (
                  <NativeSelectOption key={intensity} value={intensity}>
                    {tt(`intensities.${intensity}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {number("priority", t("priorityHint"))}
          </>,
        )}

        <fieldset className="rounded-lg border bg-card p-5">
          <legend className="float-left text-base font-semibold">{t("groups.pre")}</legend>
          <div className="clear-both flex flex-col gap-3 pt-3">
            {rows.map((row, i) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_6rem_auto]">
                <Input name="preTiming" aria-label={t("pre.timing", { n: i + 1 })} placeholder={t("pre.timingPlaceholder")} maxLength={100} defaultValue={row.timing} className="col-span-3 h-10 sm:col-span-1" />
                <Input name="preText" aria-label={t("pre.text", { n: i + 1 })} placeholder={t("pre.textPlaceholder")} maxLength={300} defaultValue={row.text} className="h-10" />
                <Input name="preCarbs" type="number" min={0} inputMode="numeric" aria-label={t("pre.carbs", { n: i + 1 })} placeholder={t("pre.carbsPlaceholder")} defaultValue={row.carbs ?? ""} className="h-10 tabular-nums" />
                <Button type="button" variant="ghost" size="icon" aria-label={t("pre.remove", { n: i + 1 })} onClick={() => setRows(rows.filter((r) => r.key !== row.key))} className="size-10">
                  <XIcon aria-hidden />
                </Button>
              </div>
            ))}
            {invalid("pre") && <p className="text-xs text-destructive-ink">{t("invalidPre")}</p>}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRows([...rows, { timing: "", text: "", carbs: null, key: next }]);
                setNext(next + 1);
              }}
              className="h-10 self-start px-3 sm:h-8"
            >
              {t("pre.add")}
            </Button>
          </div>
        </fieldset>

        {group(
          "during",
          <>
            {number("duringCarbsPerHour", "g/h")}
            {number("duringFluidPerHour", "ml/h")}
            {number("duringSodiumPerHour", "mg/h")}
            {textField("duringText")}
          </>,
        )}
        {group(
          "post",
          <>
            {number("postWithinMin", "min")}
            {number("postProtein", "g")}
            {number("postCarbs", "g")}
            {textField("postFluidText")}
          </>,
        )}

        <Button type="submit" disabled={pending} className="h-10 self-start px-5">
          {t("save")}
        </Button>
      </form>
      {template && (
        <form action={deleteFuelingTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <Button type="submit" variant="destructive" className="h-10 px-4 sm:h-8">
            {t("delete")}
          </Button>
        </form>
      )}
    </div>
  );
}
