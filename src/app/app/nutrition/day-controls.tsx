"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DAY_TYPES, type DayType } from "@/lib/enums";
import { saveDayNote, setDayType } from "./actions";

// The day type of a date: "automatic" (what the day's training and competitions make it) or set by hand. Applies at once.
export function DayTypeSelect({ clientId, date, override, derived }: { clientId: string; date: string; override: DayType | null; derived: DayType }) {
  const t = useTranslations();
  return (
    <form action={setDayType}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="date" value={date} />
      <NativeSelect
        name="dayType"
        defaultValue={override ?? ""}
        aria-label={t("DailyNutrition.dayType")}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="[&_select]:h-10 [&_select]:bg-card sm:[&_select]:h-8"
      >
        <NativeSelectOption value="">{t("DailyNutrition.auto", { dayType: t(`DayTypes.${derived}`) })}</NativeSelectOption>
        {DAY_TYPES.map((d) => (
          <NativeSelectOption key={d} value={d}>
            {t(`DayTypes.${d}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </form>
  );
}

export function DayNoteForm({ clientId, date, note }: { clientId: string; date: string; note: string | null }) {
  const t = useTranslations("DailyNutrition");
  const [state, save, pending] = useActionState(saveDayNote, null);
  const [edited, setEdited] = useState(false);
  return (
    <form
      action={(form) => {
        setEdited(false);
        save(form);
      }}
      onInput={() => setEdited(true)}
      className="mt-3 flex flex-col gap-3"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="date" value={date} />
      <Textarea name="note" aria-label={t("note")} maxLength={2000} rows={3} defaultValue={note ?? ""} placeholder={t("notePlaceholder")} />
      <div className="flex items-center justify-end gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {state && !edited && !pending && t("saved")}
        </p>
        <Button type="submit" variant="outline" disabled={pending} className="h-10 px-4 sm:h-8">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
