"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactElement, useId, useState } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Food } from "@/generated/prisma/client";
import { MICRONUTRIENTS } from "@/lib/enums";
import type { Serving } from "@/lib/foods";
import { deleteFood, saveFood } from "./food-actions";

const MACROS = ["kcal", "protein", "carbs", "fat"] as const;

// Add or edit a food (a coach's library food, a client's own): name, brand, nutrients per 100 g (fiber and sodium
// optional), and servings ("1 piece = 60 g").
export function FoodDialog({ food, trigger }: { food?: Food; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Foods");
  return (
    <FormDialog trigger={trigger} title={food ? t("editTitle") : t("addTitle")} save={saveFood} remove={food && deleteFood}>
      {(invalid) => <FoodFields food={food} invalid={invalid} />}
    </FormDialog>
  );
}

function FoodFields({ food, invalid }: { food?: Food; invalid: (field: string) => boolean }) {
  const t = useTranslations("Foods");
  const id = useId();
  // Rows keep a stable key, so removing one doesn't shift the typed values of the others.
  const [servings, setServings] = useState<{ label: string; grams: number | string; key: number }[]>(() =>
    ((food?.servings as Serving[] | undefined) ?? []).map((serving, key) => ({ ...serving, key })),
  );
  const field = (name: string, props: ComponentProps<typeof Input> = {}, className?: string) => (
    <Field key={name} id={`${id}-${name}`} label={t(`fields.${name}`)} error={invalid(name) ? t("invalid") : undefined} className={className}>
      <Input
        id={`${id}-${name}`}
        name={name}
        defaultValue={(food?.[name as keyof Food] as string | number | null | undefined) ?? ""}
        aria-invalid={invalid(name)}
        aria-describedby={`${id}-${name}-note`}
        className="h-10"
        {...props}
      />
    </Field>
  );
  const number = { type: "number", inputMode: "decimal", min: 0, step: "any" } as const;

  return (
    <>
      {food && <input type="hidden" name="id" value={food.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", { required: true, maxLength: 150 }, "sm:col-span-2")}
        {field("brand", { maxLength: 100 }, "sm:col-span-2")}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("per100")}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MACROS.map((m) => field(m, { ...number, required: true, className: "h-10 tabular-nums" }))}
          {Object.keys(MICRONUTRIENTS).map((m) => field(m, { ...number, className: "h-10 tabular-nums" }))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("servings")}</legend>
        <p className="mb-3 text-xs text-muted-foreground">{t("servingsHint")}</p>
        <div className="flex flex-col gap-2">
          {servings.map((serving) => (
            <div key={serving.key} className="flex items-center gap-2">
              <Input name="servingLabel" aria-label={t("servingLabel")} placeholder={t("servingLabelExample")} maxLength={50} defaultValue={serving.label} className="h-10 min-w-0 flex-1" />
              <Input name="servingGrams" aria-label={t("servingGrams")} type="number" inputMode="decimal" min={0} step="any" defaultValue={serving.grams} className="h-10 w-24 tabular-nums" />
              <span className="text-sm text-muted-foreground">g</span>
              <Button type="button" variant="ghost" size="icon" aria-label={t("removeServing")} onClick={() => setServings(servings.filter((s) => s.key !== serving.key))} className="size-10">
                <XIcon aria-hidden />
              </Button>
            </div>
          ))}
          {invalid("servings") && <p className="text-xs text-destructive-ink">{t("servingsInvalid")}</p>}
          {servings.length < 10 && (
            <Button type="button" variant="ghost" onClick={() => setServings([...servings, { label: "", grams: "", key: Date.now() }])} className="h-10 self-start px-2.5 text-primary-ink">
              {t("addServing")}
            </Button>
          )}
        </div>
      </fieldset>
    </>
  );
}
