"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type EntryState, logRecipe } from "../nutrition/entry-actions";

// "Log this" (CALORIES): the date, the meal and the portions eaten; the day then shows it as a snapshot.
export function LogRecipeForm({ recipeId, today, slots }: { recipeId: string; today: string; slots: string[] }) {
  const t = useTranslations("ClientRecipes");
  const id = useId();
  const [state, setState] = useState<EntryState | { logged: string }>(null);
  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border bg-card p-5">
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {t("logTitle")}
      </h2>
      <form
        action={async (form) => {
          const result = await logRecipe(form);
          setState(result ?? { logged: String(form.get("date")) });
        }}
        className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end"
      >
        <input type="hidden" name="recipeId" value={recipeId} />
        <Field id={`${id}-date`} label={t("logDate")} error={invalid("date") ? t("logInvalid") : undefined}>
          <Input id={`${id}-date`} type="date" name="date" required defaultValue={today} aria-describedby={`${id}-date-note`} className="h-10" />
        </Field>
        <Field id={`${id}-slot`} label={t("logMeal")}>
          <NativeSelect id={`${id}-slot`} name="slot" className="w-full [&_select]:h-10">
            {slots.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${id}-portions`} label={t("logPortions")} error={invalid("portions") ? t("logInvalid") : undefined}>
          <Input id={`${id}-portions`} type="number" name="portions" inputMode="decimal" min={0} step="any" required defaultValue="1" aria-describedby={`${id}-portions-note`} className="h-10 tabular-nums" />
        </Field>
        <Button type="submit" className="h-10 px-4">
          {t("log")}
        </Button>
      </form>
      {state && "logged" in state && (
        <p role="status" className="mt-3 text-sm">
          {t("logged")}{" "}
          <Link href={`/app/nutrition?date=${state.logged}`} className="font-medium text-primary-ink hover:underline">
            {t("openDay")}
          </Link>
        </p>
      )}
    </section>
  );
}
