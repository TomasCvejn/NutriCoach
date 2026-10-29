"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Supplement } from "@/generated/prisma/client";
import { SUPPLEMENT_CATEGORIES } from "@/lib/enums";
import { deleteSupplement, saveSupplement } from "./actions";

// Add a supplement (no `supplement`) or edit one, with delete while editing.
export function SupplementDialog({ clientId, supplement, trigger }: { clientId: string; supplement?: Supplement; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Supplements");
  const id = useId();
  const input = (name: "name" | "brand" | "dose" | "timing", invalid: (field: string) => boolean, max: number) => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} error={invalid(name) ? t(`invalid.${name === "name" ? "name" : "text"}`) : undefined}>
      <Input id={`${id}-${name}`} name={name} required={name === "name"} maxLength={max} defaultValue={supplement?.[name] ?? ""} aria-describedby={`${id}-${name}-note`} className="h-10" />
    </Field>
  );
  const date = (name: "activeFrom" | "activeTo", invalid: (field: string) => boolean) => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} error={invalid(name) ? t("invalid.dates") : undefined}>
      <Input id={`${id}-${name}`} name={name} type="date" defaultValue={supplement?.[name] ?? ""} aria-describedby={`${id}-${name}-note`} className="h-10" />
    </Field>
  );
  return (
    <FormDialog trigger={trigger} title={t(supplement ? "editTitle" : "addTitle")} save={saveSupplement} remove={supplement && deleteSupplement}>
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {supplement && <input type="hidden" name="id" value={supplement.id} />}
          <div className="grid grid-cols-2 gap-4">
            {input("name", invalid, 100)}
            {input("brand", invalid, 100)}
            <Field id={`${id}-category`} label={t("fields.category")}>
              <NativeSelect id={`${id}-category`} name="category" defaultValue={supplement?.category ?? "DAILY"} className="w-full [&_select]:h-10">
                {SUPPLEMENT_CATEGORIES.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {t(`categories.${c}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {input("dose", invalid, 100)}
          </div>
          {input("timing", invalid, 200)}
          <Field id={`${id}-purpose`} label={t("fields.purpose")}>
            <Textarea id={`${id}-purpose`} name="purpose" maxLength={500} rows={2} defaultValue={supplement?.purpose ?? ""} />
          </Field>
          <Field id={`${id}-notes`} label={t("fields.notes")}>
            <Textarea id={`${id}-notes`} name="notes" maxLength={2000} rows={2} defaultValue={supplement?.notes ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            {date("activeFrom", invalid)}
            {date("activeTo", invalid)}
          </div>
        </>
      )}
    </FormDialog>
  );
}
