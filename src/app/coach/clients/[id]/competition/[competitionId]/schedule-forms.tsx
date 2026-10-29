"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useActionState, useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { deleteScheduleItem, saveScheduleItem, shiftSchedule } from "@/app/app/competition/schedule-actions";
import type { ScheduleItem } from "@/generated/prisma/client";
import { SCHEDULE_TYPES } from "@/lib/enums";
import { AMOUNTS } from "@/lib/schedule";

// Add a schedule item (no `item`) or edit one, with delete while editing.
type Option = { id: string; name: string };

export function ScheduleItemDialog({ competitionId, item, recipes, supplements, trigger }: { competitionId: string; item?: ScheduleItem; recipes: Option[]; supplements: Option[]; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Schedule");
  const id = useId();
  const error = (invalid: (field: string) => boolean, field: string) => (invalid(field) ? t(`invalid.${field as "time"}`) : undefined);
  return (
    <FormDialog trigger={trigger} title={t(item ? "editTitle" : "addTitle")} save={saveScheduleItem} remove={item && deleteScheduleItem}>
      {(invalid) => (
        <>
          <input type="hidden" name="competitionId" value={competitionId} />
          {item && <input type="hidden" name="id" value={item.id} />}
          <div className="grid grid-cols-2 gap-4">
            <Field id={`${id}-time`} label={t("fields.time")} error={error(invalid, "time")}>
              <Input id={`${id}-time`} name="time" type="time" required defaultValue={item?.time ?? ""} aria-describedby={`${id}-time-note`} className="h-10" />
            </Field>
            <Field id={`${id}-type`} label={t("fields.type")}>
              <NativeSelect id={`${id}-type`} name="type" defaultValue={item?.type ?? "CARBS"} className="w-full [&_select]:h-10">
                {SCHEDULE_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {t(`types.${type}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id={`${id}-title`} label={t("fields.title")} error={error(invalid, "title")}>
            <Input id={`${id}-title`} name="title" required maxLength={100} defaultValue={item?.title ?? ""} aria-describedby={`${id}-title-note`} className="h-10" />
          </Field>
          <Field id={`${id}-details`} label={t("fields.details")}>
            <Input id={`${id}-details`} name="details" maxLength={500} defaultValue={item?.details ?? ""} className="h-10" />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {AMOUNTS.map((amount) => (
              <Field key={amount} id={`${id}-${amount}`} label={t(`fields.${amount}`)} error={invalid(amount) ? t("invalid.amount") : undefined}>
                <Input id={`${id}-${amount}`} name={amount} type="number" inputMode="numeric" min={0} defaultValue={item?.[amount] ?? ""} aria-describedby={`${id}-${amount}-note`} className="h-10 tabular-nums" />
              </Field>
            ))}
          </div>
          {supplements.length > 0 && (
            <Field id={`${id}-supplement`} label={t("fields.supplement")} error={error(invalid, "supplementId")}>
              <NativeSelect id={`${id}-supplement`} name="supplementId" defaultValue={item?.supplementId ?? ""} className="w-full [&_select]:h-10">
                <NativeSelectOption value="">{t("noSupplement")}</NativeSelectOption>
                {supplements.map((supplement) => (
                  <NativeSelectOption key={supplement.id} value={supplement.id}>
                    {supplement.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {recipes.length > 0 && (
            <Field id={`${id}-recipe`} label={t("fields.recipe")} error={error(invalid, "recipeId")}>
              <NativeSelect id={`${id}-recipe`} name="recipeId" defaultValue={item?.recipeId ?? ""} className="w-full [&_select]:h-10">
                <NativeSelectOption value="">{t("noRecipe")}</NativeSelectOption>
                {recipes.map((recipe) => (
                  <NativeSelectOption key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </>
      )}
    </FormDialog>
  );
}

// Move every item by ±N minutes (refused when one would leave the day).
export function ShiftForm({ competitionId }: { competitionId: string }) {
  const t = useTranslations("Schedule");
  const id = useId();
  const [state, shift, pending] = useActionState(shiftSchedule, null);
  return (
    <form action={shift} className="flex items-end gap-2">
      <input type="hidden" name="competitionId" value={competitionId} />
      <Field id={`${id}-minutes`} label={t("shiftBy")} error={state ? t("invalid.shift") : undefined}>
        <Input id={`${id}-minutes`} name="minutes" type="number" inputMode="numeric" step={5} required aria-describedby={`${id}-minutes-note`} className="h-10 w-28 tabular-nums sm:h-8" />
      </Field>
      <Button type="submit" variant="outline" disabled={pending} className={`h-10 sm:h-8 ${state ? "mb-6" : ""}`}>
        {t("shift")}
      </Button>
    </form>
  );
}
