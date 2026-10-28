"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FluidLog } from "@/generated/prisma/client";
import { DRINK_TYPES } from "@/lib/enums";
import { addFluid, deleteFluid, savePreset, updateFluid } from "./actions";

// The drink fields: amount, type, optional sodium and carbs (and a name for a saved drink).
function DrinkFields({ invalid, drink, named }: { invalid: (field: string) => boolean; drink?: Partial<FluidLog>; named?: boolean }) {
  const t = useTranslations("Hydration");
  const id = useId();
  const error = (field: string) => (invalid(field) ? t("invalid") : undefined);
  const number = (name: "ml" | "sodium" | "carbs", required = false) => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} error={error(name)}>
      <Input id={`${id}-${name}`} name={name} type="number" inputMode="numeric" min={0} required={required} defaultValue={drink?.[name] ?? ""} aria-describedby={`${id}-${name}-note`} className="h-10 tabular-nums" />
    </Field>
  );
  return (
    <>
      {named && (
        <Field id={`${id}-name`} label={t("fields.name")} error={error("name")}>
          <Input id={`${id}-name`} name="name" required maxLength={50} aria-describedby={`${id}-name-note`} className="h-10" />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        {number("ml", true)}
        <Field id={`${id}-type`} label={t("fields.drinkType")}>
          <NativeSelect id={`${id}-type`} name="drinkType" defaultValue={drink?.drinkType ?? "WATER"} className="w-full [&_select]:h-10">
            {DRINK_TYPES.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {t(`types.${d}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {number("sodium")}
        {number("carbs")}
      </div>
    </>
  );
}

const trigger = (text: string, label?: string) => (
  <Button variant="outline" className="h-10 px-3" aria-label={label}>
    {text}
  </Button>
);

// A drink of any amount and type, for the given day.
export function AddDrinkDialog({ date }: { date: string }) {
  const t = useTranslations("Hydration");
  return (
    <FormDialog trigger={trigger(t("custom"))} title={t("addTitle")} save={addFluid}>
      {(invalid) => (
        <>
          <input type="hidden" name="date" value={date} />
          <DrinkFields invalid={invalid} />
        </>
      )}
    </FormDialog>
  );
}

export function EditDrinkDialog({ drink, label }: { drink: FluidLog; label: string }) {
  const t = useTranslations("Hydration");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" className="-mr-2.5 h-10 px-2.5 sm:h-8" aria-label={label}>
          {t("edit")}
        </Button>
      }
      title={t("editTitle")}
      save={updateFluid}
      remove={deleteFluid}
    >
      {(invalid) => (
        <>
          <input type="hidden" name="id" value={drink.id} />
          <DrinkFields invalid={invalid} drink={drink} />
        </>
      )}
    </FormDialog>
  );
}

export function SavePresetDialog() {
  const t = useTranslations("Hydration");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" className="h-10 self-start px-2.5 text-primary-ink sm:h-8">
          {t("savePreset")}
        </Button>
      }
      title={t("presetTitle")}
      save={savePreset}
    >
      {(invalid) => <DrinkFields invalid={invalid} named />}
    </FormDialog>
  );
}
