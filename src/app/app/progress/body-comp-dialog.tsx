"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { BodyComp } from "@/generated/prisma/client";
import { BODY_COMP_METHODS, BODY_FIELDS, type BodyField } from "@/lib/enums";
import { deleteBodyComp, saveBodyComp } from "./actions";

// Add a body-composition entry (no `entry`) or edit one, with delete while editing. Every value is optional, but at
// least one is needed; lean mass left empty is computed from weight and body fat.
export function BodyCompDialog({ clientId, today, entry, label }: { clientId: string; today: string; entry?: BodyComp; label?: string }) {
  const t = useTranslations("BodyComp");
  const id = useId();
  const number = (field: BodyField, invalid: (field: string) => boolean) => (
    <Field key={field} id={`${id}-${field}`} label={t(`fields.${field}`)} hint={field === "leanMassKg" ? t("leanHint") : undefined} error={invalid(field) ? t("invalid") : undefined}>
      <Input
        id={`${id}-${field}`}
        name={field}
        type="number"
        inputMode="decimal"
        step={0.1}
        min={0}
        defaultValue={entry?.[field] ?? ""}
        aria-describedby={`${id}-${field}-note`}
        className="h-10 tabular-nums"
      />
    </Field>
  );
  return (
    <FormDialog
      trigger={
        entry ? (
          <Button variant="ghost" className="-mr-2.5 h-10 px-2.5 sm:h-8" aria-label={label}>
            {t("edit")}
          </Button>
        ) : (
          <Button className="h-10 px-4 sm:h-8 sm:px-3">{t("add")}</Button>
        )
      }
      title={t(entry ? "editTitle" : "addTitle")}
      save={saveBodyComp}
      remove={entry && deleteBodyComp}
    >
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {entry && <input type="hidden" name="id" value={entry.id} />}
          {invalid("values") && (
            <p role="alert" className="text-sm text-destructive-ink">
              {t("noValues")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field id={`${id}-date`} label={t("fields.date")} error={invalid("date") ? t("invalidDate") : undefined}>
              <Input id={`${id}-date`} name="date" type="date" required max={today} defaultValue={entry?.date ?? today} aria-describedby={`${id}-date-note`} className="h-10" />
            </Field>
            <Field id={`${id}-method`} label={t("fields.method")}>
              <NativeSelect id={`${id}-method`} name="method" defaultValue={entry?.method ?? "SCALE"} className="w-full [&_select]:h-10">
                {BODY_COMP_METHODS.map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {t(`methods.${m}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {BODY_FIELDS.map((field) => number(field, invalid))}
          </div>
          <Field id={`${id}-note`} label={t("fields.note")}>
            <Textarea id={`${id}-note`} name="note" maxLength={1000} rows={2} defaultValue={entry?.note ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
